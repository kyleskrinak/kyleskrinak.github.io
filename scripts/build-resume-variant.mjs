#!/usr/bin/env node
/**
 * Build a local resume variant PDF using a JSON variant config.
 * Never deployed — local use only. Variant configs live outside the repo.
 *
 * Usage:
 *   node scripts/build-resume-variant.mjs --variant <name-or-path> [--output <path>] [--base-url <url>]
 *
 * Config resolution order:
 *   1. Literal path (absolute or contains path separator)
 *   2. $RESUME_VARIANTS_DIR/<name>.json
 *   3. ~/Claude/Projects/KDS Resume/variants/<name>.json
 *
 * The DOM transform filters li[data-facets] bullets per facet rules, reorders
 * and caps them per entry, swaps h1 text when a title override is set, and can
 * insert a Certifications section (from scripts/data/certifications.json) and a
 * Skills section (from the resume frontmatter's skills_inventory) for one-off
 * local variants. Neither section renders on the published resume: both are
 * reservoirs a variant draws from. Scope paragraphs and employer paragraphs are
 * never removed. The one-page gate and content verification in
 * resume-render.mjs run after the transform.
 */

import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import GithubSlugger from "github-slugger";
import { parseFlags, parsePreviewPort } from "./lib/pdf-helpers.mjs";
import { renderResumePdf } from "./lib/resume-render.mjs";
import { RESUME_SOURCE, readResumeSource } from "./lib/resume-source.mjs";
// Single source of truth for the facet vocabulary — shared with the remark
// plugin that emits the data-facets attributes this script filters on.
import { FACETS } from "../src/lib/remark-facets.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CERTIFICATIONS_SOURCE = path.join(ROOT, "scripts/data/certifications.json");
// Both cert dates use YYYY-MM: month precision is all a resume prints, and the
// string form sorts lexicographically, so comparing issued to expires needs no
// Date parsing (and no timezone to get wrong).
const CERT_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Valid bullet_order entry keys are the resume's rendered h2 ids. Derive them
// from the source headings with the same slugger Astro uses (github-slugger),
// so adding or renaming a section can never leave a hardcoded list silently
// stale.
function deriveEntryIds() {
  // The EXPANDED body — placeholders replaced by their frontmatter-built
  // markdown. Reading the raw body would omit every data-driven section's id
  // (the education anchors among them), so a valid config naming one would be
  // rejected as unknown.
  const { expandedBody } = readResumeSource(RESUME_SOURCE);
  const slugger = new GithubSlugger();
  const ids = new Set();
  // Every ATX heading feeds the one slugger, in document order, because Astro's
  // duplicate counter is shared across heading levels: skipping the other levels
  // could hand an h2 a different id than the page renders. Only h2 ids are
  // collected — a bullet_order key names an entry, and an entry is an h2.
  for (const m of expandedBody.matchAll(/^(#{1,6})[ \t]+(.+)$/gm)) {
    const slug = slugger.slug(m[2].trim());
    if (m[1].length === 2) ids.add(slug);
  }
  if (ids.size === 0) throw new Error(`No section headings found in ${RESUME_SOURCE}`);
  return ids;
}

let cachedEntryIds = null;

/**
 * The entry-id vocabulary, derived once per process on first use.
 *
 * Lazy rather than a module-load constant: importing this module must not read
 * and parse the resume source. The unit tests import it for the pure validators
 * and pass their own vocabulary, and a module-load derivation both slowed every
 * import and silently coupled those tests to live resume content.
 */
export function getKnownEntryIds() {
  cachedEntryIds ??= deriveEntryIds();
  return cachedEntryIds;
}

const FLAGS = {
  "--variant": { key: "variant", value: true },
  "--output": { key: "output", value: true },
  "--base-url": { key: "baseUrl", value: true },
};

// Shared with print-resume-pdf.mjs so the variable cannot mean two ports.
export function parseResumePreviewPort(env = process.env) {
  return parsePreviewPort("RESUME_PREVIEW_PORT", 4323, env);
}

function resolveConfigPath(nameOrPath) {
  if (path.isAbsolute(nameOrPath) || nameOrPath.includes("/") || nameOrPath.includes("\\")) {
    return path.resolve(nameOrPath);
  }
  // Bare name: append .json unless the caller already did (avoids name.json.json).
  const file = nameOrPath.endsWith(".json") ? nameOrPath : `${nameOrPath}.json`;
  if (process.env.RESUME_VARIANTS_DIR) {
    return path.join(process.env.RESUME_VARIANTS_DIR, file);
  }
  return path.join(os.homedir(), "Claude", "Projects", "KDS Resume", "variants", file);
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function throwValidationError(label, errors) {
  if (errors.length) {
    throw new Error(`${label}:\n${errors.map(e => `  - ${e}`).join("\n")}`);
  }
}

export function validateIncludeCertsShape(includeCerts) {
  if (includeCerts === undefined) return [];
  if (includeCerts === "all") return [];
  if (!Array.isArray(includeCerts)) {
    return ['include_certs: must be an array of cert ids or "all"'];
  }

  const errors = [];
  const invalid = includeCerts.filter(id => typeof id !== "string" || id.trim().length === 0);
  if (invalid.length) errors.push("include_certs: must contain only non-empty strings");

  const duplicates = findDuplicates(includeCerts.filter(id => typeof id === "string"));
  if (duplicates.length) {
    errors.push(`include_certs: duplicate id(s): ${duplicates.join(", ")}`);
  }

  return errors;
}

function includeCertsRequestsCerts(includeCerts) {
  return includeCerts === "all" || (Array.isArray(includeCerts) && includeCerts.length > 0);
}

/**
 * `include_skills` selects categories from the resume's skills_inventory. That
 * inventory is deliberately a superset of what the one-page resume prints: the
 * page itself renders no skills section, and a variant draws the categories a
 * particular audience cares about. Its category ids are their own vocabulary,
 * separate from FACETS — see docs/features/resume-variants.md.
 */
export function validateIncludeSkillsShape(includeSkills) {
  if (includeSkills === undefined) return [];
  if (includeSkills === "all") return [];
  if (!Array.isArray(includeSkills)) {
    return ['include_skills: must be an array of skill category ids or "all"'];
  }

  const errors = [];
  const invalid = includeSkills.filter(id => typeof id !== "string" || id.trim().length === 0);
  if (invalid.length) errors.push("include_skills: must contain only non-empty strings");

  const duplicates = findDuplicates(includeSkills.filter(id => typeof id === "string"));
  if (duplicates.length) {
    errors.push(`include_skills: duplicate id(s): ${duplicates.join(", ")}`);
  }

  return errors;
}

export function includeSkillsRequestsSkills(includeSkills) {
  return includeSkills === "all" || (Array.isArray(includeSkills) && includeSkills.length > 0);
}

/**
 * Validate a variant config against the vocabularies it names.
 *
 * `vocabularies` carries the three id sets: `certIds` and `skillIds` are the
 * second-pass cross-checks (absent on the first pass, which validates shape
 * before the data files load), and `entryIds` overrides the resume-derived entry
 * ids. A caller supplying `entryIds` — every unit test does — keeps this function
 * pure: nothing reads the resume source.
 */
export function validateConfig(cfg, configPath, vocabularies = {}) {
  const { certIds: knownCertIds, skillIds: knownSkillIds, entryIds } = vocabularies;
  // Resolved on demand, so a config naming no entry id never triggers a read.
  const knownEntryIds = () => entryIds ?? getKnownEntryIds();
  const errors = [];

  if (!isObject(cfg)) {
    throwValidationError(`Invalid variant config ${configPath}`, ["config: must be an object"]);
  }

  if (cfg.title !== undefined) {
    if (typeof cfg.title !== "string") {
      errors.push("title: must be a string");
    } else if (cfg.title.trim().length === 0) {
      errors.push("title: must be a non-empty string");
    }
  }

  for (const field of ["include_facets", "exclude_facets"]) {
    if (cfg[field] !== undefined) {
      if (!Array.isArray(cfg[field])) {
        errors.push(`${field}: must be an array`);
      } else {
        // Intersection check: each facet must exist in the known vocabulary.
        const unknown = cfg[field].filter(f => typeof f !== "string" || !FACETS.has(f));
        if (unknown.length) errors.push(`${field}: unknown facet(s): ${unknown.join(", ")}`);
      }
    }
  }

  if (cfg.max_bullets_per_entry !== undefined) {
    if (!Number.isInteger(cfg.max_bullets_per_entry) || cfg.max_bullets_per_entry < 1) {
      errors.push("max_bullets_per_entry: must be a positive integer");
    }
  }

  if (cfg.bullet_order !== undefined) {
    if (!isObject(cfg.bullet_order)) {
      errors.push("bullet_order: must be an object");
    } else {
      for (const [key, val] of Object.entries(cfg.bullet_order)) {
        if (!knownEntryIds().has(key)) {
          errors.push(`bullet_order: unknown entry key "${key}"`);
        } else if (!Array.isArray(val) || !val.every(n => Number.isInteger(n) && n >= 0)) {
          errors.push(`bullet_order.${key}: must be an array of non-negative integers`);
        }
      }
    }
  }

  errors.push(...validateIncludeCertsShape(cfg.include_certs));
  if (knownCertIds && Array.isArray(cfg.include_certs)) {
    const unknown = cfg.include_certs.filter(id => !knownCertIds.has(id));
    if (unknown.length) errors.push(`include_certs: unknown cert id(s): ${unknown.join(", ")}`);
  }

  errors.push(...validateIncludeSkillsShape(cfg.include_skills));
  if (knownSkillIds && Array.isArray(cfg.include_skills)) {
    const unknown = cfg.include_skills.filter(id => !knownSkillIds.has(id));
    if (unknown.length) errors.push(`include_skills: unknown skill category id(s): ${unknown.join(", ")}`);
  }

  for (const field of ["anchor_before_id", "skills_anchor_before_id"]) {
    if (cfg[field] === undefined) continue;
    if (typeof cfg[field] !== "string" || cfg[field].trim().length === 0) {
      errors.push(`${field}: must be a non-empty string`);
    } else if (!knownEntryIds().has(cfg[field])) {
      errors.push(`${field}: unknown entry key "${cfg[field]}"`);
    }
  }

  // Certs carry a default anchor in certifications.json; skills have no data
  // file to default from, so a skills request must name its own anchor —
  // explicitly, or by inheriting the cert anchor.
  if (
    includeSkillsRequestsSkills(cfg.include_skills) &&
    cfg.skills_anchor_before_id === undefined &&
    cfg.anchor_before_id === undefined
  ) {
    errors.push(
      "include_skills: requires skills_anchor_before_id (or anchor_before_id) naming the entry to insert before",
    );
  }

  const KNOWN_KEYS = new Set([
    "title",
    "include_facets",
    "exclude_facets",
    "max_bullets_per_entry",
    "bullet_order",
    "include_certs",
    "anchor_before_id",
    "include_skills",
    "skills_anchor_before_id",
  ]);
  const unknownKeys = Object.keys(cfg).filter(k => !KNOWN_KEYS.has(k));
  if (unknownKeys.length) errors.push(`unknown config key(s): ${unknownKeys.join(", ")}`);

  throwValidationError(`Invalid variant config ${configPath}`, errors);
}

export function validateBulletOrderRange(entryId, orderSpec, keptCount) {
  const invalid = orderSpec.filter(idx => idx >= keptCount);
  if (invalid.length) {
    throw new Error(
      `bullet_order.${entryId}: index ${invalid.join(", ")} out of range for ${keptCount} kept bullet(s) after filtering`
    );
  }
}

export function validateCertificationsData(data, sourcePath, knownEntryIds) {
  const errors = [];

  if (!isObject(data)) {
    throwValidationError(`Invalid certifications data ${sourcePath}`, [
      "root: must be an object",
    ]);
  }

  if (typeof data.anchor_before_id !== "string" || data.anchor_before_id.trim().length === 0) {
    errors.push("anchor_before_id: must be a non-empty string");
  } else if (!knownEntryIds.has(data.anchor_before_id)) {
    errors.push(`anchor_before_id: unknown entry key "${data.anchor_before_id}"`);
  }

  if (!Array.isArray(data.certifications) || data.certifications.length === 0) {
    errors.push("certifications: must be a non-empty array");
  } else {
    const ids = [];
    data.certifications.forEach((cert, idx) => {
      const prefix = `certifications[${idx}]`;
      if (!isObject(cert)) {
        errors.push(`${prefix}: must be an object`);
        return;
      }

      if (typeof cert.id !== "string" || cert.id.trim().length === 0) {
        errors.push(`${prefix}.id: must be a non-empty string`);
      } else {
        // Same normalization as the skill categories above, for the same reason:
        // duplicate detection here and resolveCerts's lookup both key off this
        // value, so an untrimmed id makes `include_certs: ["az-104"]` fail
        // against a source id of `" az-104 "`.
        cert.id = cert.id.trim();
        ids.push(cert.id);
      }

      if (typeof cert.name !== "string" || cert.name.trim().length === 0) {
        errors.push(`${prefix}.name: must be a non-empty string`);
      }

      if (
        hasOwn(cert, "issuer") &&
        (typeof cert.issuer !== "string" || cert.issuer.trim().length === 0)
      ) {
        errors.push(`${prefix}.issuer: must be a non-empty string when present`);
      }

      const issuedValid =
        hasOwn(cert, "issued") && typeof cert.issued === "string" && CERT_MONTH_RE.test(cert.issued);
      const expiresValid =
        hasOwn(cert, "expires") &&
        typeof cert.expires === "string" &&
        CERT_MONTH_RE.test(cert.expires);

      if (hasOwn(cert, "issued") && !issuedValid) {
        errors.push(`${prefix}.issued: must match YYYY-MM`);
      }

      if (hasOwn(cert, "expires") && !expiresValid) {
        errors.push(`${prefix}.expires: must match YYYY-MM`);
      }

      // Only compare once both parsed, or a single malformed date would report
      // twice. Equal months are rejected: a cert that expires the month it was
      // issued is a data error, not a zero-length validity window.
      if (issuedValid && expiresValid && cert.expires <= cert.issued) {
        errors.push(
          `${prefix}.expires: must be after issued (${cert.issued}), got ${cert.expires}`
        );
      }

      if (hasOwn(cert, "facets")) {
        errors.push(`${prefix}.facets: not supported until facet-based cert selection is implemented`);
      }
    });

    const duplicateIds = findDuplicates(ids);
    if (duplicateIds.length) {
      errors.push(`certifications: duplicate id(s): ${duplicateIds.join(", ")}`);
    }
  }

  throwValidationError(`Invalid certifications data ${sourcePath}`, errors);
  return data;
}

export function loadCertifications(sourcePath = CERTIFICATIONS_SOURCE, knownEntryIds) {
  if (!existsSync(sourcePath)) {
    throw new Error(`Certification data file not found: ${sourcePath}`);
  }

  let data;
  try {
    data = JSON.parse(readFileSync(sourcePath, "utf8"));
  } catch (err) {
    throw new Error(`Failed to parse certification data ${sourcePath}: ${err.message}`);
  }

  // The resume-derived vocabulary unless a caller supplies its own, resolved
  // here rather than as a default so the derivation stays lazy.
  return validateCertificationsData(data, sourcePath, knownEntryIds ?? getKnownEntryIds());
}

export function resolveCerts(includeCerts, certData) {
  if (!includeCertsRequestsCerts(includeCerts)) return [];

  const certs = certData.certifications;
  if (includeCerts === "all") return [...certs];

  const byId = new Map(certs.map(cert => [cert.id, cert]));
  return includeCerts.map(id => {
    const cert = byId.get(id);
    if (!cert) throw new Error(`include_certs: unknown cert id "${id}"`);
    return cert;
  });
}

/**
 * Read the skill categories from the resume frontmatter. Throws when the
 * inventory is absent: a config asking for skills that the source cannot supply
 * is a mistake to surface, not an empty section to render.
 */
export function loadSkillCategories(sourcePath = RESUME_SOURCE) {
  const { data } = readResumeSource(sourcePath);
  const categories = data.skills_inventory?.categories;
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error(`No skills_inventory.categories found in ${sourcePath}`);
  }
  const errors = [];
  const ids = [];
  categories.forEach((cat, idx) => {
    const prefix = `skills_inventory.categories[${idx}]`;
    if (!isObject(cat)) {
      errors.push(`${prefix}: must be a mapping`);
      return;
    }
    if (typeof cat.id !== "string" || cat.id.trim().length === 0) {
      errors.push(`${prefix}.id: must be a non-empty string`);
    } else {
      // Normalized in place, not merely recorded: src/content.config.ts trims the
      // id before its pattern test, so the page path reads `leadership` where this
      // raw parse would keep `" leadership "`. Every consumer of the returned
      // categories keys off this value — duplicate detection here, the
      // knownSkillIds set and resolveSkills — so trimming once makes all three
      // agree with the schema instead of rejecting a config that names the id as
      // the schema would normalize it.
      cat.id = cat.id.trim();
      ids.push(cat.id);
    }
    if (typeof cat.name !== "string" || cat.name.trim().length === 0) {
      errors.push(`${prefix}.name: must be a non-empty string`);
    }
    if (!Array.isArray(cat.skills) || cat.skills.length === 0) {
      errors.push(`${prefix}.skills: must be a non-empty array`);
    } else {
      // Members, not just the array. readResumeSource is a raw YAML parse, so
      // the content-collection schema's z.array(z.string().trim().min(1)) never
      // runs on this path; without this, `[null]`, `[123]` or `["   "]` reach
      // the injected list as blank or numeric skill text, and PDF verification
      // checks only the category name, so the variant still passes.
      cat.skills.forEach((skill, skillIdx) => {
        if (typeof skill !== "string" || skill.trim().length === 0) {
          errors.push(`${prefix}.skills[${skillIdx}]: must be a non-empty string`);
        }
      });
    }
  });
  const duplicateIds = findDuplicates(ids);
  if (duplicateIds.length) {
    errors.push(`skills_inventory.categories: duplicate id(s): ${duplicateIds.join(", ")}`);
  }
  throwValidationError(`Invalid skills inventory in ${sourcePath}`, errors);
  return categories;
}

/** Selected categories in the order the config names them ("all" keeps source order). */
export function resolveSkills(includeSkills, categories) {
  if (!includeSkillsRequestsSkills(includeSkills)) return [];
  if (includeSkills === "all") return [...categories];

  const byId = new Map(categories.map(cat => [cat.id, cat]));
  return includeSkills.map(id => {
    const cat = byId.get(id);
    if (!cat) throw new Error(`include_skills: unknown skill category id "${id}"`);
    return cat;
  });
}

export function injectSkills(content, categories, anchorId) {
  if (!content) throw new Error("Skills injection failed: .resume-content not found");
  if (!Array.isArray(categories)) throw new Error("Skills injection failed: categories must be an array");
  if (categories.length === 0) return null;
  if (typeof anchorId !== "string" || anchorId.trim().length === 0) {
    throw new Error("Skills injection failed: skills_anchor_before_id is required");
  }

  function cssEscape(value) {
    if (globalThis.CSS?.escape) return globalThis.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  const doc = content.ownerDocument;
  const anchor = content.querySelector(`#${cssEscape(anchorId)}`);
  if (!anchor) throw new Error(`Skills anchor not found: ${anchorId}`);

  // The page's h2 print rules hide section headings and add a decorative
  // ::after; an injected heading needs the same exemption the cert heading uses.
  const styleId = "resume-variant-skills-heading-style";
  if (!doc.getElementById(styleId)) {
    const style = doc.createElement("style");
    style.id = styleId;
    style.textContent = [
      "@media print {",
      "  .resume-content h2.skills-heading { display: block; }",
      "  .resume-content h2.skills-heading::after { content: none; }",
      "}",
    ].join("\n");
    (doc.head || doc.documentElement || content).appendChild(style);
  }

  const heading = doc.createElement("h2");
  heading.className = "skills-heading";
  heading.textContent = "Skills";

  const list = doc.createElement("ul");
  for (const cat of categories) {
    const li = doc.createElement("li");
    const label = doc.createElement("strong");
    label.textContent = cat.name;
    li.appendChild(label);
    li.appendChild(doc.createTextNode(`: ${cat.skills.join(", ")}`));
    list.appendChild(li);
  }

  content.insertBefore(heading, anchor);
  content.insertBefore(list, anchor);

  const renderedItems = Array.from(list.querySelectorAll("li"));
  if (renderedItems.length !== categories.length) {
    throw new Error(
      `Skills injection count mismatch: expected ${categories.length}, rendered ${renderedItems.length}`
    );
  }
  categories.forEach((cat, idx) => {
    if (!renderedItems[idx].textContent.includes(cat.name)) {
      throw new Error(`Skills injection missing category in rendered list: ${cat.name}`);
    }
  });

  return { heading, list };
}

// A bare "(2026-01)" has always meant the issued month, so that output stays
// byte-identical; an expiry alone gets labelled rather than inheriting a meaning
// it never had. Both present render as a range.
export function certDateSuffix(cert) {
  if (cert.issued && cert.expires) return ` (${cert.issued} – ${cert.expires})`;
  if (cert.issued) return ` (${cert.issued})`;
  if (cert.expires) return ` (expires ${cert.expires})`;
  return "";
}

/**
 * One certification as its list item reads. The injected DOM and the PDF content
 * expectation both come from here, so verification covers the issuer and the
 * dates instead of only the name.
 */
export function certListItemText(cert) {
  return cert.name + (cert.issuer ? ` — ${cert.issuer}` : "") + certDateSuffix(cert);
}

export function injectCerts(content, certs, anchorId) {
  if (!content) throw new Error("Certification injection failed: .resume-content not found");
  if (!Array.isArray(certs)) throw new Error("Certification injection failed: certs must be an array");
  if (certs.length === 0) return null;
  if (typeof anchorId !== "string" || anchorId.trim().length === 0) {
    throw new Error("Certification injection failed: anchor_before_id is required");
  }

  function cssEscape(value) {
    if (globalThis.CSS?.escape) return globalThis.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  const doc = content.ownerDocument;
  const anchor = content.querySelector(`#${cssEscape(anchorId)}`);
  if (!anchor) throw new Error(`Certification anchor not found: ${anchorId}`);

  const styleId = "resume-variant-cert-heading-style";
  if (!doc.getElementById(styleId)) {
    const style = doc.createElement("style");
    style.id = styleId;
    style.textContent = [
      "@media print {",
      "  .resume-content h2.cert-heading { display: block; }",
      "  .resume-content h2.cert-heading::after { content: none; }",
      "}",
    ].join("\n");
    (doc.head || doc.documentElement || content).appendChild(style);
  }

  const heading = doc.createElement("h2");
  heading.className = "cert-heading";
  heading.textContent = "Certifications";

  const list = doc.createElement("ul");
  for (const cert of certs) {
    const li = doc.createElement("li");
    li.textContent = certListItemText(cert);
    list.appendChild(li);
  }

  content.insertBefore(heading, anchor);
  content.insertBefore(list, anchor);

  const renderedItems = Array.from(list.querySelectorAll("li"));
  if (renderedItems.length !== certs.length) {
    throw new Error(
      `Certification injection count mismatch: expected ${certs.length}, rendered ${renderedItems.length}`
    );
  }
  certs.forEach((cert, idx) => {
    if (!renderedItems[idx].textContent.includes(cert.name)) {
      throw new Error(`Certification injection missing cert in rendered list: ${cert.name}`);
    }
  });

  return { heading, list };
}

/*
 * Injector serialization.
 *
 * page.addScriptTag sends a function's OWN source and nothing else: a
 * module-scope helper the function calls does NOT travel with it, and the free
 * identifier throws a ReferenceError in the browser that no Node-side unit test
 * of the same function would ever see. So every helper an injector depends on is
 * declared in the same script, as `const <name> = <source>` — a form that keeps
 * binding the name if the helper is later refactored into an arrow function.
 *
 * The script's own body must spell these global names literally, for the same
 * reason: a constant below would not cross either.
 *
 * tests/unit/resume-variant.test.mjs evaluates the exact strings these builders
 * return, so a missing dependency fails there the way it would in Chromium. It
 * imports injectorScript itself to assert that failure mode directly — hence the
 * export on a function nothing else outside this module calls.
 */
export const CERT_INJECTOR_GLOBAL = "__resumeVariantInjectCerts";
export const SKILLS_INJECTOR_GLOBAL = "__resumeVariantInjectSkills";

export function injectorScript(globalName, fn, deps) {
  return [
    ...deps.map(dep => `const ${dep.name} = ${dep.toString()};`),
    `window.${globalName} = ${fn.toString()};`,
  ].join("\n");
}

/** Dependency order matters only for readability; each is a function expression. */
export function certInjectorScript() {
  return injectorScript(CERT_INJECTOR_GLOBAL, injectCerts, [certDateSuffix, certListItemText]);
}

export function skillsInjectorScript() {
  return injectorScript(SKILLS_INJECTOR_GLOBAL, injectSkills, []);
}

export function buildTransform(config, injections = {}) {
  const {
    certs: resolvedCerts = [],
    certAnchorId = null,
    skills: resolvedSkills = [],
    skillsAnchorId = null,
  } = injections;
  return async (page) => {
    const certsRequested = resolvedCerts.length > 0;
    const skillsRequested = resolvedSkills.length > 0;
    if (certsRequested) {
      await page.addScriptTag({ content: certInjectorScript() });
    }
    if (skillsRequested) {
      await page.addScriptTag({ content: skillsInjectorScript() });
    }

    const emptied = await page.evaluate((payload) => {
      if (!payload || !payload.cfg) {
        throw new Error("Invalid variant transform payload: cfg missing");
      }
      if (payload.certsRequested) {
        if (!Array.isArray(payload.certs)) {
          throw new Error("Invalid variant transform payload: certs missing");
        }
        if (payload.certs.length !== payload.expectedCertCount) {
          throw new Error(
            `Invalid variant transform payload: expected ${payload.expectedCertCount} cert(s), got ${payload.certs.length}`
          );
        }
        if (typeof payload.anchorBeforeId !== "string" || payload.anchorBeforeId.trim().length === 0) {
          throw new Error("Invalid variant transform payload: anchorBeforeId missing");
        }
        if (typeof window.__resumeVariantInjectCerts !== "function") {
          throw new Error("Invalid variant transform payload: cert injector missing");
        }
      }
      if (payload.skillsRequested) {
        if (!Array.isArray(payload.skills)) {
          throw new Error("Invalid variant transform payload: skills missing");
        }
        if (payload.skills.length !== payload.expectedSkillCount) {
          throw new Error(
            `Invalid variant transform payload: expected ${payload.expectedSkillCount} skill category/categories, got ${payload.skills.length}`
          );
        }
        if (typeof payload.skillsAnchorId !== "string" || payload.skillsAnchorId.trim().length === 0) {
          throw new Error("Invalid variant transform payload: skillsAnchorId missing");
        }
        if (typeof window.__resumeVariantInjectSkills !== "function") {
          throw new Error("Invalid variant transform payload: skills injector missing");
        }
      }

      const cfg = payload.cfg;
      const emptiedEntries = [];

      function bulletPasses(li, incl, excl) {
        const raw = li.getAttribute("data-facets");
        if (!raw) return true; // untagged bullets always render
        const facets = raw.split(" ").filter(Boolean);
        // exclude beats include
        if (excl.length && facets.some(f => excl.includes(f))) return false;
        if (incl.length && !facets.some(f => incl.includes(f))) return false;
        return true;
      }

      function validateBulletOrderRangeInPage(entryId, orderSpec, keptCount) {
        const invalid = orderSpec.filter(idx => idx >= keptCount);
        if (invalid.length) {
          throw new Error(
            `bullet_order.${entryId}: index ${invalid.join(", ")} out of range for ${keptCount} kept bullet(s) after filtering`
          );
        }
      }

      const incl = cfg.include_facets || [];
      const excl = cfg.exclude_facets || [];
      const maxBullets = cfg.max_bullets_per_entry;
      const entryOrders = cfg.bullet_order || {};

      const content = document.querySelector(".resume-content");
      if (!content) throw new Error("Resume content root not found");

      // Walk top-level children, grouping by entry (h2 boundary).
      // Entry shape: h2 → p(employer) → [p(scope)] → [ul]
      // Hachette has no scope p; Stat Store and education entries have no ul.
      const children = Array.from(content.children);
      let i = 0;
      while (i < children.length) {
        const el = children[i];
        if (el.tagName !== "H2") { i++; continue; }

        const entryId = el.id;

        // Collect elements until next H2
        let j = i + 1;
        while (j < children.length && children[j].tagName !== "H2") j++;
        const entryEls = children.slice(i + 1, j);

        const ul = entryEls.find(e => e.tagName === "UL");
        if (ul) {
          const allBullets = Array.from(ul.querySelectorAll("li"));

          // 1. Filter by facets
          let kept = allBullets.filter(li => bulletPasses(li, incl, excl));

          // 2. Reorder by post-filter indices
          const orderSpec = entryOrders[entryId];
          if (orderSpec && orderSpec.length) {
            validateBulletOrderRangeInPage(entryId, orderSpec, kept.length);
            const reordered = [];
            const used = new Set();
            for (const idx of orderSpec) {
              reordered.push(kept[idx]);
              used.add(idx);
            }
            // Append kept bullets not in the order spec
            kept.forEach((li, idx) => { if (!used.has(idx)) reordered.push(li); });
            kept = reordered;
          }

          // 3. Cap
          if (maxBullets != null && kept.length > maxBullets) kept = kept.slice(0, maxBullets);

          // Apply: remove all, re-append in order
          allBullets.forEach(li => li.remove());
          kept.forEach(li => ul.appendChild(li));

          // Heading + employer + scope are always kept even when bullets are emptied.
          if (kept.length === 0) emptiedEntries.push(entryId);
        }

        i = j;
      }

      // Swap h1 text when title override is set.
      if (cfg.title) {
        const h1 = document.querySelector("h1");
        if (h1) h1.textContent = cfg.title.trim();
      }

      // Skills first, then certs: each insertion lands immediately before the
      // anchor, so injecting skills first leaves them above the certs when both
      // share one anchor.
      if (payload.skillsRequested) {
        window.__resumeVariantInjectSkills(content, payload.skills, payload.skillsAnchorId);
      }
      if (payload.certsRequested) {
        window.__resumeVariantInjectCerts(content, payload.certs, payload.anchorBeforeId);
      }

      return emptiedEntries;
    }, {
      cfg: config,
      certs: resolvedCerts,
      certsRequested,
      expectedCertCount: resolvedCerts.length,
      anchorBeforeId: certAnchorId,
      skills: resolvedSkills,
      skillsRequested,
      expectedSkillCount: resolvedSkills.length,
      skillsAnchorId,
    });

    // Surface emptied entries in the terminal — a page-context console.warn
    // would land only in the browser console, never here. Heading + scope kept.
    for (const id of emptied) {
      console.warn(`⚠ [variant] entry "${id}" left with no bullets after filtering — heading and scope kept.`);
    }
  };
}

async function main() {
  let port;
  try {
    port = parseResumePreviewPort(process.env);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const args = parseFlags(process.argv.slice(2), FLAGS, {
    variant: null,
    output: null,
    baseUrl: null,
  });

  if (!args.variant) {
    console.error("Missing required flag: --variant <name-or-path>");
    process.exit(2);
  }

  const configPath = resolveConfigPath(args.variant);
  if (!existsSync(configPath)) {
    console.error(`Variant config not found: ${configPath}`);
    process.exit(2);
  }

  let config;
  try {
    config = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (err) {
    console.error(`Failed to parse variant config ${configPath}: ${err.message}`);
    process.exit(2);
  }

  let resolvedCerts = [];
  let certAnchorId = null;
  let resolvedSkills = [];
  let skillsAnchorId = null;
  try {
    validateConfig(config, configPath);
    let knownCertIds = null;
    let knownSkillIds = null;
    let certData = null;
    let skillCategories = null;

    if (includeCertsRequestsCerts(config.include_certs)) {
      certData = loadCertifications();
      knownCertIds = new Set(certData.certifications.map(cert => cert.id));
    }
    if (includeSkillsRequestsSkills(config.include_skills)) {
      skillCategories = loadSkillCategories();
      knownSkillIds = new Set(skillCategories.map(cat => cat.id));
    }
    // Second pass, now that the id vocabularies are known: a config naming an
    // id that does not exist must fail before any rendering starts.
    if (knownCertIds || knownSkillIds) {
      validateConfig(config, configPath, { certIds: knownCertIds, skillIds: knownSkillIds });
    }

    if (certData) {
      resolvedCerts = resolveCerts(config.include_certs, certData);
      certAnchorId = config.anchor_before_id || certData.anchor_before_id;
    }
    if (skillCategories) {
      resolvedSkills = resolveSkills(config.include_skills, skillCategories);
      skillsAnchorId = config.skills_anchor_before_id || config.anchor_before_id;
    }
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  // basename(..., ".json") strips the extension for a bare "name", a "name.json",
  // and a full path alike — a stable variant name for the default output.
  const variantName = path.basename(configPath, ".json");
  // Default output next to the config (outside the repo) so a private variant
  // PDF never lands in the working tree where it could be committed by accident.
  const output = args.output || path.join(path.dirname(configPath), `${variantName}.pdf`);

  console.log(`→ Variant config: ${configPath}`);

  // Title and the injected content are the only fields that change verification
  // expectations; headings and employers are never removed by the transform.
  // A certification is required as its whole list item — name, issuer and dates —
  // so a suffix the injector built wrong cannot pass on the name alone.
  const requireText = [
    ...resolvedCerts.map(cert => certListItemText(cert)),
    ...resolvedSkills.map(cat => cat.name),
  ];
  const expectedOverrides = {
    ...(config.title ? { title: config.title.trim() } : {}),
    ...(requireText.length ? { requireText } : {}),
  };

  await renderResumePdf({
    output,
    baseUrl: args.baseUrl,
    port,
    transform: buildTransform(config, {
      certs: resolvedCerts,
      certAnchorId,
      skills: resolvedSkills,
      skillsAnchorId,
    }),
    expectedOverrides,
  });
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error(`✘ ${err.message}`);
    process.exit(1);
  });
}
