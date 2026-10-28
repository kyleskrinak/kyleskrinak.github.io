#!/usr/bin/env node
/**
 * Build a local resume variant (PDF, .docx and .txt) using a JSON variant config.
 * Never deployed — local use only. Variant configs live outside the repo.
 *
 * Usage:
 *   node scripts/build-resume-variant.mjs --variant <name-or-path> [--output <path.pdf>] [--formats <list>] [--base-url <url>]
 *
 * --output names the PDF (default: <variant>.pdf beside the config); the .docx
 * and .txt go beside it under the same base name. --formats is a
 * comma-separated subset of pdf,docx,txt (default: all three).
 *
 * Config resolution order:
 *   1. Literal path (absolute or contains path separator)
 *   2. $RESUME_VARIANTS_DIR/<name>.json
 *   3. ~/Claude/Projects/KDS Resume/variants/<name>.json
 *
 * The DOM transform filters li[data-facets] bullets per facet rules and keeps
 * only the bullets bullet_order lists, in its order. It changes
 * nothing else: Manager Tools puts no headline, no skills list and no
 * certifications on a resume (docs/references/manager-tools-rubric.md), so a
 * variant keeps the published name line, and the resume frontmatter's
 * skills_inventory never renders, in a variant or anywhere else. Headings, which
 * carry each role's admin line, and scope paragraphs are never removed. The
 * one-page gate and content verification in resume-render.mjs run after the
 * transform.
 */

import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fromMarkdown } from "mdast-util-from-markdown";
import { parseFlags, parsePreviewPort } from "./lib/pdf-helpers.mjs";
import { outputPaths, parseFormats } from "./lib/resume-formats.mjs";
import { renderResume } from "./lib/resume-render.mjs";
import { RESUME_SOURCE, readResumeSource } from "./lib/resume-source.mjs";
import { headingIds } from "../src/lib/resume-sections.mjs";
// Single source of truth for the facet vocabulary — shared with the remark
// plugin that emits the data-facets attributes this script filters on.
import { FACETS } from "../src/lib/remark-facets.mjs";

// A bullet_order item names its entry by the resume's rendered h2 id. Derive
// the valid ids from the source headings through headingIds, the function the
// remark plugin sets the page's ids with, so adding or renaming a section can
// never leave a hardcoded list silently stale.
function deriveEntryIds() {
  // The EXPANDED body — placeholders replaced by their frontmatter-built
  // markdown. Reading the raw body would omit every data-driven section's id
  // (the current role's among them), so a valid config naming one would be
  // rejected as unknown.
  const { expandedBody } = readResumeSource(RESUME_SOURCE);
  // Every heading feeds the one slugger, in document order, because the
  // duplicate counter is shared across heading levels: skipping the other levels
  // could hand an h2 a different id than the page renders. Only h2 ids are
  // collected — a bullet_order item names an entry, and an entry is an h2.
  const ids = new Set(
    headingIds(fromMarkdown(expandedBody))
      .filter(({ node }) => node.depth === 2)
      .map(({ id }) => id),
  );
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
  "--formats": { key: "formats", value: true },
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

function throwValidationError(label, errors) {
  if (errors.length) {
    throw new Error(`${label}:\n${errors.map(e => `  - ${e}`).join("\n")}`);
  }
}

// A bullet_order item: "<entry id>/<n>", where n counts that entry's bullets as
// written, from 0. A heading slug never carries a slash, and the index takes no
// leading zero, so "senior-manager-it/01" cannot dodge the duplicate check.
const BULLET_KEY_RE = /^([^/]+)\/(0|[1-9]\d*)$/;

function parseBulletKey(key) {
  const match = typeof key === "string" ? BULLET_KEY_RE.exec(key) : null;
  if (!match) {
    throw new Error(
      `bullet_order: ${JSON.stringify(key)} must be "<entry id>/<n>", as in "senior-manager-it/0"`
    );
  }
  return { key, entryId: match[1], index: Number(match[2]) };
}

/**
 * Validate a variant config against the vocabularies it names.
 *
 * `vocabularies.entryIds` overrides the resume-derived entry ids. A caller
 * supplying it — every unit test does — keeps this function pure: nothing reads
 * the resume source.
 */
export function validateConfig(cfg, configPath, vocabularies = {}) {
  const { entryIds } = vocabularies;
  // Resolved on demand, so a config naming no entry id never triggers a read.
  const knownEntryIds = () => entryIds ?? getKnownEntryIds();
  const errors = [];

  if (!isObject(cfg)) {
    throwValidationError(`Invalid variant config ${configPath}`, ["config: must be an object"]);
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

  // One ranked queue for the whole page. The index range waits for the page,
  // which alone knows how many bullets each entry has.
  if (cfg.bullet_order !== undefined) {
    if (!Array.isArray(cfg.bullet_order)) {
      errors.push('bullet_order: must be an array of "<entry id>/<n>" items, most relevant first');
    } else {
      const seen = new Set();
      for (const key of cfg.bullet_order) {
        let item;
        try {
          item = parseBulletKey(key);
        } catch (err) {
          errors.push(err.message);
          continue;
        }
        if (!knownEntryIds().has(item.entryId)) {
          errors.push(`bullet_order: unknown entry id "${item.entryId}" in "${key}"`);
        }
        if (seen.has(key)) errors.push(`bullet_order: "${key}" is listed more than once`);
        seen.add(key);
      }
    }
  }

  const KNOWN_KEYS = new Set([
    "include_facets",
    "exclude_facets",
    "bullet_order",
  ]);
  const unknownKeys = Object.keys(cfg).filter(k => !KNOWN_KEYS.has(k));
  if (unknownKeys.length) errors.push(`unknown config key(s): ${unknownKeys.join(", ")}`);

  throwValidationError(`Invalid variant config ${configPath}`, errors);
}

export function buildTransform(config) {
  // Parsed here, in Node, so the page receives entry ids and indexes, not keys.
  const queue = config.bullet_order?.map(parseBulletKey) ?? null;
  return async (page) => {
    const emptied = await page.evaluate((payload) => {
      if (!payload || !payload.cfg) {
        throw new Error("Invalid variant transform payload: cfg missing");
      }

      const cfg = payload.cfg;
      const queue = payload.queue;
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

      const incl = cfg.include_facets || [];
      const excl = cfg.exclude_facets || [];

      const content = document.querySelector(".resume-content");
      if (!content) throw new Error("Resume content root not found");

      // Walk top-level children, grouping by entry (h2 boundary).
      // Entry shape: h2(admin line) → [p(scope)] → [ul]
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
        // An entry with no list has no bullets, so any item naming it is past
        // the end.
        const allBullets = ul ? Array.from(ul.querySelectorAll("li")) : [];

        let kept;
        if (queue) {
          // The page-wide queue: this entry's items, in queue order, so a
          // variant trims for length by cutting from the end of the list. A
          // variant chooses bullets by relevance, not by count (Manager Tools
          // sets no bullet count), so an unlisted bullet drops. Indexes count
          // the bullets as written, so changing facets never renumbers the
          // queue, and a listed bullet the facets exclude is a contradiction.
          kept = queue
            .filter(item => item.entryId === entryId)
            .map(({ key, index }) => {
              if (index >= allBullets.length) {
                throw new Error(
                  `bullet_order: "${key}" is past the end of "${entryId}", which has ${allBullets.length} bullet(s)`
                );
              }
              const li = allBullets[index];
              if (!bulletPasses(li, incl, excl)) {
                throw new Error(`bullet_order: "${key}" lists a bullet the facets exclude`);
              }
              return li;
            });
        } else {
          // No queue: every bullet the facets pass, in source order.
          kept = allBullets.filter(li => bulletPasses(li, incl, excl));
        }

        if (ul) {
          // Apply: remove all, re-append in order
          allBullets.forEach(li => li.remove());
          kept.forEach(li => ul.appendChild(li));

          // Heading (admin line) + scope are always kept even when bullets are emptied.
          if (kept.length === 0) emptiedEntries.push(entryId);
        }

        i = j;
      }

      return emptiedEntries;
    }, { cfg: config, queue });

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
    formats: "pdf,docx,txt",
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

  try {
    validateConfig(config, configPath);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  // basename(..., ".json") strips the extension for a bare "name", a "name.json",
  // and a full path alike — a stable variant name for the default output.
  const variantName = path.basename(configPath, ".json");
  // Default output next to the config (outside the repo) so a private variant
  // file never lands in the working tree where it could be committed by accident.
  const output = args.output || path.join(path.dirname(configPath), `${variantName}.pdf`);
  let outputs;
  try {
    outputs = outputPaths(output, parseFormats(args.formats));
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  console.log(`→ Variant config: ${configPath}`);

  // The transform removes only bullets, so the source's verification
  // expectations — name, contact, headings — hold for a variant unchanged.
  await renderResume({
    outputs,
    baseUrl: args.baseUrl,
    port,
    transform: buildTransform(config),
  });
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error(`✘ ${err.message}`);
    process.exit(1);
  });
}
