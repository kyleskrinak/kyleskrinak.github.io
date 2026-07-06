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
 * and caps them per entry, and swaps h1 text when a title override is set.
 * Scope paragraphs and employer paragraphs are never removed. The one-page gate
 * and content verification in resume-render.mjs run after the transform.
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

// Default 4323 sidesteps the common local collisions: astro dev (4321),
// print-resume-pdf.mjs (4321), and the Playwright test server (4322). Override
// with RESUME_PREVIEW_PORT. renderResumePdf also tears the preview down on
// SIGINT/SIGTERM, so an interrupted run won't strand a server on this port.
const PORT = Number(process.env.RESUME_PREVIEW_PORT || 4323);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error(
    `Invalid RESUME_PREVIEW_PORT '${process.env.RESUME_PREVIEW_PORT}' — must be an integer 1-65535.`
  );
  process.exit(2);
}

const FLAGS = {
  "--variant": { key: "variant", value: true },
  "--output": { key: "output", value: true },
  "--base-url": { key: "baseUrl", value: true },
};

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

function validateConfig(cfg, configPath) {
  const errors = [];

  if (cfg.title !== undefined && typeof cfg.title !== "string") {
    errors.push("title: must be a string");
  }

  for (const field of ["include_facets", "exclude_facets"]) {
    if (cfg[field] !== undefined) {
      if (!Array.isArray(cfg[field])) {
        errors.push(`${field}: must be an array`);
      } else {
        // Intersection check: each facet must exist in the known vocabulary.
        const unknown = cfg[field].filter(f => !FACETS.has(f));
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
    if (
      typeof cfg.bullet_order !== "object" ||
      Array.isArray(cfg.bullet_order) ||
      cfg.bullet_order === null
    ) {
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

  const KNOWN_KEYS = new Set([
    "title", "include_facets", "exclude_facets", "max_bullets_per_entry", "bullet_order",
  ]);
  const unknownKeys = Object.keys(cfg).filter(k => !KNOWN_KEYS.has(k));
  if (unknownKeys.length) errors.push(`unknown config key(s): ${unknownKeys.join(", ")}`);

  if (errors.length) {
    throw new Error(
      `Invalid variant config ${configPath}:\n${errors.map(e => `  - ${e}`).join("\n")}`
    );
  }
}

function buildTransform(config) {
  return async (page) => {
    const emptied = await page.evaluate((cfg) => {
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
      const maxBullets = cfg.max_bullets_per_entry;
      const entryOrders = cfg.bullet_order || {};

      const content = document.querySelector(".resume-content");
      if (!content) return;

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
            const reordered = [];
            const used = new Set();
            for (const idx of orderSpec) {
              if (idx < kept.length) { reordered.push(kept[idx]); used.add(idx); }
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
        if (h1) h1.textContent = cfg.title;
      }

      return emptiedEntries;
    }, config);

    // Surface emptied entries in the terminal — a page-context console.warn
    // would land only in the browser console, never here. Heading + scope kept.
    for (const id of emptied) {
      console.warn(`⚠ [variant] entry "${id}" left with no bullets after filtering — heading and scope kept.`);
    }
  };
}

async function main() {
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

  try {
    validateConfig(config, configPath);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  // basename(..., ".json") strips the extension for a bare "name", a "name.json",
  // and a full path alike — a stable variant name for the default output.
  const variantName = path.basename(args.variant, ".json");
  // Default output next to the config (outside the repo) so a private variant
  // PDF never lands in the working tree where it could be committed by accident.
  const output = args.output || path.join(path.dirname(configPath), `${variantName}.pdf`);

  console.log(`→ Variant config: ${configPath}`);

  // title is the only field that changes a verification expectation; headings
  // and employers are never removed by the transform so their expectations hold.
  const expectedOverrides = config.title ? { title: config.title } : {};

  await renderResumePdf({
    output,
    baseUrl: args.baseUrl,
    port: PORT,
    transform: buildTransform(config),
    expectedOverrides,
  });
}

main().catch(err => {
  console.error(`✘ ${err.message}`);
  process.exit(1);
});
