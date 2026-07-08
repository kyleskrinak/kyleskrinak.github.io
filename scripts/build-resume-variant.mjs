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
 * append a Certifications section for one-off local variants. Scope paragraphs
 * and employer paragraphs are never removed. The one-page gate and content
 * verification in resume-render.mjs run after the transform.
 */

import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import GithubSlugger from "github-slugger";
import { parseFlags } from "./lib/pdf-helpers.mjs";
import { renderResumePdf } from "./lib/resume-render.mjs";
// Single source of truth for the facet vocabulary — shared with the remark
// plugin that emits the data-facets attributes this script filters on.
import { FACETS } from "../src/lib/remark-facets.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RESUME_SOURCE = path.join(ROOT, "src/content/pages/resume/index.md");
const CERTIFICATIONS_SOURCE = path.join(ROOT, "scripts/data/certifications.json");

// Valid bullet_order entry keys are the resume's rendered h2 ids. Derive them
// from the source headings with the same slugger Astro uses (github-slugger),
// so adding or renaming a section can never leave a hardcoded list silently
// stale. One slugger instance in document order matches Astro's dedup exactly.
function deriveEntryIds() {
  const raw = readFileSync(RESUME_SOURCE, "utf8").replace(/\r\n/g, "\n");
  const body = raw.replace(/^---\n[\s\S]*?\n---/, ""); // drop frontmatter
  const slugger = new GithubSlugger();
  const ids = new Set();
  for (const m of body.matchAll(/^## (.+)$/gm)) ids.add(slugger.slug(m[1].trim()));
  if (ids.size === 0) throw new Error(`No section headings found in ${RESUME_SOURCE}`);
  return ids;
}
const KNOWN_ENTRY_IDS = deriveEntryIds();

const FLAGS = {
  "--variant": { key: "variant", value: true },
  "--output": { key: "output", value: true },
  "--base-url": { key: "baseUrl", value: true },
};

export function parseResumePreviewPort(env = process.env) {
  const raw = env.RESUME_PREVIEW_PORT || "4323";
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid RESUME_PREVIEW_PORT '${env.RESUME_PREVIEW_PORT}' — must be an integer 1-65535.`
    );
  }
  return port;
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

export function validateConfig(cfg, configPath, knownCertIds) {
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
        if (!KNOWN_ENTRY_IDS.has(key)) {
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

  if (cfg.anchor_before_id !== undefined) {
    if (typeof cfg.anchor_before_id !== "string" || cfg.anchor_before_id.trim().length === 0) {
      errors.push("anchor_before_id: must be a non-empty string");
    } else if (!KNOWN_ENTRY_IDS.has(cfg.anchor_before_id)) {
      errors.push(`anchor_before_id: unknown entry key "${cfg.anchor_before_id}"`);
    }
  }

  const KNOWN_KEYS = new Set([
    "title",
    "include_facets",
    "exclude_facets",
    "max_bullets_per_entry",
    "bullet_order",
    "include_certs",
    "anchor_before_id",
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

      if (
        hasOwn(cert, "issued") &&
        (typeof cert.issued !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(cert.issued))
      ) {
        errors.push(`${prefix}.issued: must match YYYY-MM`);
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

export function loadCertifications(
  sourcePath = CERTIFICATIONS_SOURCE,
  knownEntryIds = KNOWN_ENTRY_IDS
) {
  if (!existsSync(sourcePath)) {
    throw new Error(`Certification data file not found: ${sourcePath}`);
  }

  let data;
  try {
    data = JSON.parse(readFileSync(sourcePath, "utf8"));
  } catch (err) {
    throw new Error(`Failed to parse certification data ${sourcePath}: ${err.message}`);
  }

  return validateCertificationsData(data, sourcePath, knownEntryIds);
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
    li.textContent =
      cert.name +
      (cert.issuer ? ` — ${cert.issuer}` : "") +
      (cert.issued ? ` (${cert.issued})` : "");
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

export function buildTransform(config, resolvedCerts = [], anchorBeforeId = null) {
  return async (page) => {
    const certsRequested = resolvedCerts.length > 0;
    if (certsRequested) {
      await page.addScriptTag({
        content: `window.__resumeVariantInjectCerts = ${injectCerts.toString()};`,
      });
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

      if (payload.certsRequested) {
        window.__resumeVariantInjectCerts(content, payload.certs, payload.anchorBeforeId);
      }

      return emptiedEntries;
    }, {
      cfg: config,
      certs: resolvedCerts,
      certsRequested,
      expectedCertCount: resolvedCerts.length,
      anchorBeforeId,
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
  let anchorBeforeId = null;
  try {
    validateConfig(config, configPath);
    if (includeCertsRequestsCerts(config.include_certs)) {
      const certData = loadCertifications();
      const knownCertIds = new Set(certData.certifications.map(cert => cert.id));
      validateConfig(config, configPath, knownCertIds);
      resolvedCerts = resolveCerts(config.include_certs, certData);
      anchorBeforeId = config.anchor_before_id || certData.anchor_before_id;
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

  // Title and injected cert names are the only fields that change verification
  // expectations; headings and employers are never removed by the transform.
  const expectedOverrides = {
    ...(config.title ? { title: config.title.trim() } : {}),
    ...(resolvedCerts.length ? { requireText: resolvedCerts.map(cert => cert.name) } : {}),
  };

  await renderResumePdf({
    output,
    baseUrl: args.baseUrl,
    port,
    transform: buildTransform(config, resolvedCerts, anchorBeforeId),
    expectedOverrides,
  });
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error(`✘ ${err.message}`);
    process.exit(1);
  });
}
