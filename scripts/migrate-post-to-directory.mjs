#!/usr/bin/env node
/**
 * Migrate flat blog posts to per-post co-located directories.
 *
 * Input:  src/content/blog/<slug>.md   referencing src/assets/images/foo.jpg
 *         or /assets/images/foo.jpg (raw HTML)
 *
 * Output: src/content/blog/<slug>/
 *         ├── index.md  (or index.mdx if raw HTML img tags present)
 *         └── <co-located images>
 *
 * Rewrites:
 *   - frontmatter image|heroImage|ogImage paths → ./<basename>
 *   - markdown ![alt](path) image paths → ./<basename>
 *   - HTML <img src="..."> blocks → <Image src={importedVar} alt=...>
 *     (file is renamed to .mdx and import statements added after frontmatter)
 *
 * Usage:
 *   node scripts/migrate-post-to-directory.mjs <slug>...      migrate listed slugs
 *   node scripts/migrate-post-to-directory.mjs --all          migrate every flat .md
 *   node scripts/migrate-post-to-directory.mjs <slug> --dry-run
 */
import { readFile, writeFile, mkdir, copyFile, unlink, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, relative } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const ROOT = process.cwd();
const BLOG_DIR = join(ROOT, 'src/content/blog');
const SRC_ASSETS = join(ROOT, 'src/assets/images');
const PUBLIC_ASSETS_IMAGES = join(ROOT, 'public/assets/images');
const PUBLIC_ASSETS = join(ROOT, 'public/assets');

const FRONTMATTER_IMAGE_KEYS = ['image', 'heroImage', 'ogImage'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const all = args.includes('--all');
const explicitSlugs = args.filter(a => !a.startsWith('--'));

if (!all && explicitSlugs.length === 0) {
  console.error('Usage: migrate-post-to-directory.mjs <slug>... | --all [--dry-run]');
  process.exit(2);
}

function resolveImageSource(refPath) {
  // refPath examples:
  //   ../../assets/images/foo.jpg  (Astro processed, src/assets/images/foo.jpg)
  //   /assets/images/foo.jpg       (raw, public/assets/images/foo.jpg)
  //   /assets/foo.jpg              (raw, public/assets/foo.jpg)
  const filename = basename(refPath);
  const candidates = [
    join(SRC_ASSETS, filename),
    join(PUBLIC_ASSETS_IMAGES, filename),
    join(PUBLIC_ASSETS, filename),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function sanitizeBasename(filename) {
  // "in memorandum.svg" -> "in-memorandum.svg"
  // Preserves extension, lowercases nothing, replaces unsafe chars with "-"
  const dot = filename.lastIndexOf('.');
  const stem = dot >= 0 ? filename.slice(0, dot) : filename;
  const ext = dot >= 0 ? filename.slice(dot) : '';
  const safeStem = stem.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return safeStem + ext;
}

function sanitizeForImport(filename) {
  // 2026-03-09-marathon-banana.webp -> img_2026_03_09_marathon_banana
  const stem = filename.replace(/\.[^.]+$/, '');
  const safe = stem.replace(/[^a-zA-Z0-9]/g, '_');
  return `img_${safe}`;
}

function splitFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error('No frontmatter found');
  return { fm: match[1], body: match[2] };
}

function findAllRefs(fm, body) {
  // Returns Map<originalRefPath, { sourcePath, basename, importName }>
  const refs = new Map();
  const data = parseYaml(fm) ?? {};

  function add(refPath) {
    if (refs.has(refPath)) return;
    const src = resolveImageSource(refPath);
    if (!src) {
      throw new Error(`Could not resolve image: ${refPath}`);
    }
    const safeBase = sanitizeBasename(basename(src));
    refs.set(refPath, {
      sourcePath: src,
      basename: safeBase,
      importName: sanitizeForImport(safeBase),
    });
  }

  // Frontmatter image fields
  for (const key of FRONTMATTER_IMAGE_KEYS) {
    if (typeof data[key] === 'string' && data[key].trim()) {
      add(data[key].trim());
    }
  }

  // Markdown ![alt](path)
  const mdImg = /!\[[^\]]*\]\(([^)]+)\)/g;
  let m;
  while ((m = mdImg.exec(body)) !== null) {
    const ref = m[1].trim();
    if (ref.startsWith('http://') || ref.startsWith('https://')) continue;
    add(ref);
  }

  // HTML <img src="...">
  const htmlImg = /<img[^>]*\ssrc=["']([^"']+)["'][^>]*>/g;
  while ((m = htmlImg.exec(body)) !== null) {
    const ref = m[1].trim();
    if (ref.startsWith('http://') || ref.startsWith('https://')) continue;
    add(ref);
  }

  return { data, refs };
}

function rewriteFrontmatter(data, refs) {
  const next = { ...data };
  for (const key of FRONTMATTER_IMAGE_KEYS) {
    if (typeof next[key] === 'string' && next[key].trim()) {
      const ref = refs.get(next[key].trim());
      if (ref) next[key] = `./${ref.basename}`;
    }
  }
  return next;
}

function rewriteBody(body, refs, isMdx) {
  let out = body;

  // Markdown ![alt](path)
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, path) => {
    const ref = refs.get(path.trim());
    if (!ref) return match;
    return `![${alt}](./${ref.basename})`;
  });

  if (!isMdx) return out;

  // Strip <style>...</style> blocks: MDX parses CSS `{` `}` as JSX expressions.
  // These blocks are Jekyll-era cruft that duplicates Figure.astro styles.
  out = out.replace(/<style[^>]*>[\s\S]*?<\/style>\s*/g, '');

  // For MDX: rewrite <img src="..." alt="..." class="..." /> to <Image>
  // Preserves surrounding <figure>/<figcaption> markup.
  out = out.replace(/<img\b([^>]*?)\s*\/?>/g, (match, attrs) => {
    const srcMatch = attrs.match(/\ssrc=["']([^"']+)["']/);
    if (!srcMatch) return match;
    const src = srcMatch[1].trim();
    const ref = refs.get(src);
    if (!ref) return match;
    const rest = attrs.replace(/\ssrc=["'][^"']+["']/, '').trim();
    const restPart = rest ? ` ${rest}` : '';
    return `<Image src={${ref.importName}}${restPart} />`;
  });

  return out;
}

function buildImportBlock(refs) {
  const lines = ['import { Image } from "astro:assets";'];
  const seen = new Set();
  for (const ref of refs.values()) {
    if (seen.has(ref.importName)) continue;
    seen.add(ref.importName);
    lines.push(`import ${ref.importName} from "./${ref.basename}";`);
  }
  return lines.join('\n');
}

const migratedSources = new Set();

async function migratePost(slug) {
  const flatPath = join(BLOG_DIR, `${slug}.md`);
  const dirPath = join(BLOG_DIR, slug);

  if (!existsSync(flatPath)) {
    if (existsSync(dirPath)) {
      console.log(`  ${slug}: already migrated, skipping`);
      return { skipped: true };
    }
    throw new Error(`Post not found: ${flatPath}`);
  }
  if (existsSync(dirPath)) {
    throw new Error(`Target directory already exists: ${dirPath}`);
  }

  const content = await readFile(flatPath, 'utf8');
  const { fm, body } = splitFrontmatter(content);
  const { data, refs } = findAllRefs(fm, body);

  const hasHtmlImg = /<img\b[^>]*>/.test(body);
  const ext = hasHtmlImg ? 'mdx' : 'md';
  const destFile = join(dirPath, `index.${ext}`);

  const newData = rewriteFrontmatter(data, refs);
  const newBody = rewriteBody(body, refs, hasHtmlImg);
  const importBlock = hasHtmlImg && refs.size > 0 ? `\n${buildImportBlock(refs)}\n` : '';

  const newContent = `---\n${stringifyYaml(newData)}---\n${importBlock}${newBody}`;

  console.log(`  ${slug}: ${refs.size} image(s), ${ext}, target ${relative(ROOT, destFile)}`);
  if (dryRun) {
    for (const [origRef, ref] of refs) {
      console.log(`    - ${origRef} → ./${ref.basename}  (source: ${relative(ROOT, ref.sourcePath)})`);
    }
    return { dryRun: true, refs: refs.size };
  }

  await mkdir(dirPath, { recursive: true });
  // Copy (don't move) — images may be shared across posts. A post-migration
  // sweep removes the originals at the end of an --all run.
  for (const ref of refs.values()) {
    await copyFile(ref.sourcePath, join(dirPath, ref.basename));
    migratedSources.add(ref.sourcePath);
  }
  await writeFile(destFile, newContent, 'utf8');
  await unlink(flatPath);

  return { refs: refs.size, ext };
}

async function sweepOrphans() {
  // Delete each migrated source file. Each file is the original of an image
  // that was copied into a post directory during this run, so the original
  // location is now redundant.
  const results = { deleted: 0, skipped: 0 };
  for (const src of migratedSources) {
    if (!existsSync(src)) {
      results.skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`  sweep (dry): would delete ${relative(ROOT, src)}`);
    } else {
      await unlink(src);
    }
    results.deleted++;
  }
  return results;
}

async function listFlatPosts() {
  const entries = await readdir(BLOG_DIR);
  const flats = [];
  for (const e of entries) {
    if (!e.endsWith('.md')) continue;
    const fullPath = join(BLOG_DIR, e);
    const s = await stat(fullPath);
    if (!s.isFile()) continue;
    flats.push(e.replace(/\.md$/, ''));
  }
  return flats.sort();
}

async function main() {
  const slugs = all ? await listFlatPosts() : explicitSlugs;
  console.log(`Migrating ${slugs.length} post(s)${dryRun ? ' (dry run)' : ''}:`);

  const results = { migrated: 0, skipped: 0, failed: [] };
  for (const slug of slugs) {
    try {
      const r = await migratePost(slug);
      if (r.skipped) results.skipped++;
      else results.migrated++;
    } catch (err) {
      console.error(`  ${slug}: FAILED — ${err.message}`);
      results.failed.push({ slug, error: err.message });
    }
  }
  console.log(`\nMigrated: ${results.migrated}, skipped: ${results.skipped}, failed: ${results.failed.length}`);
  if (results.failed.length > 0) process.exit(1);

  if (all || args.includes('--sweep')) {
    console.log('\nSweeping migrated source files...');
    const sweep = await sweepOrphans();
    console.log(`  ${sweep.deleted} deleted, ${sweep.skipped} already gone`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
