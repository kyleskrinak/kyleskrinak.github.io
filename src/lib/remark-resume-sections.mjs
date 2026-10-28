import { fromMarkdown } from "mdast-util-from-markdown";
import {
  adminLineSegments,
  classifyPlaceholder,
  headingIds,
  isEmployerLine,
  mdastText,
  parseEmployerLine,
  renderResumeSection,
} from "./resume-sections.mjs";

/**
 * Expands the resume's section placeholders (`<!-- current-role -->`,
 * `<!-- education -->`) into real headings and employer lines built from the
 * page's frontmatter, then folds every employer line into the heading above it
 * as the Manager Tools admin line.
 *
 * The section markdown comes from src/lib/resume-sections.mjs, the same module
 * the Node scripts use, so the rendered page, the PDF content verifier, the
 * resume linter, and the variant builder's entry-id derivation all expand to
 * identical text. Parsing that markdown (rather than hand-building MDAST) is
 * what guarantees it: there is one rendered form, not two implementations of it.
 *
 * Heading ids are set before the fold, from the title alone, through the same
 * `headingIds` the variant builder uses for the entry ids `bullet_order` items
 * name. Astro keeps an id a heading already carries, so the fold's dates never
 * reach an id.
 *
 * Inert on every other page — the plugin returns before touching a document
 * that is not the resume source, so it runs harmlessly across the whole
 * content collection.
 */

/**
 * The one document whose placeholder-shaped comments this plugin owns.
 *
 * It matters because the plugin runs on every markdown document in the project,
 * and the ownership is total: both the expansion and the typo guard stop here.
 * `<!-- more -->` in a blog post is an ordinary HTML comment, and so is
 * `<!-- education -->` — only this file's frontmatter carries the data a
 * placeholder names. Matched on the path suffix: Astro hands the plugin an
 * absolute path, and backslashes are folded so a Windows checkout matches too.
 */
const RESUME_SOURCE_SUFFIX = "content/pages/resume/index.md";

function expansionError(file, node, err) {
  const where = file?.path ?? "unknown file";
  const message = `[remark-resume-sections] ${where}: ${err.message}`;
  // file.fail throws a VFileMessage carrying the node's position, which is what
  // Astro reports; the returned Error covers a caller that supplies no vfile.
  if (file?.fail) file.fail(message, node);
  return new Error(message);
}

/**
 * A paragraph rebuilt as the one markdown line an employer line is — bold
 * text, then plain text — so `parseEmployerLine` reads the paragraph as the
 * line the source holds. Null for a paragraph carrying anything else (a link,
 * emphasis, a line break inside the bold), which is not an employer line.
 */
function employerLineSource(paragraph) {
  let source = "";
  for (const child of paragraph.children) {
    if (child.type === "text") {
      source += child.value;
    } else if (child.type === "strong" && child.children.every(c => c.type === "text")) {
      source += `**${mdastText(child)}**`;
    } else {
      return null;
    }
  }
  return source;
}

/**
 * True for a paragraph that reads as an employer line once its markup is
 * flattened — a lead bold run, then the line's tail. The fold throws on one
 * that `employerLineSource` rejects: left unfolded, the page would print a
 * stray paragraph under a heading with no dates, and the PDF verifier, which
 * runs this same fold, would agree with the page and pass.
 */
function looksLikeEmployerLine(paragraph) {
  const [lead, ...rest] = paragraph.children;
  if (lead?.type !== "strong") return false;
  return isEmployerLine(`**${mdastText(lead)}**${rest.map(mdastText).join("")}`);
}

/**
 * Replace each employer-line paragraph and the h2 above it with one h2 holding
 * the admin line. The set-off segments become `strong`, which resume.css
 * bolds; the separators and the location stay plain text. Returns the folded
 * headings.
 */
function foldAdminLines(tree, file) {
  const folded = [];
  // Backwards, so each removal leaves the earlier indexes in place.
  for (let i = tree.children.length - 1; i >= 0; i--) {
    const node = tree.children[i];
    if (node.type !== "paragraph") continue;
    const source = employerLineSource(node);
    if (source === null) {
      if (looksLikeEmployerLine(node)) {
        throw expansionError(
          file,
          node,
          new Error(
            `employer line "${mdastText(node).trim()}" carries markup the fold cannot read — write it as bold text, then plain text`,
          ),
        );
      }
      continue;
    }
    const fields = parseEmployerLine(source);
    if (!fields) continue;

    const heading = tree.children[i - 1];
    if (heading?.type !== "heading" || heading.depth !== 2) {
      throw expansionError(
        file,
        node,
        new Error(`employer line "${source.trim()}" must sit directly below its role's ## heading`),
      );
    }
    heading.children = adminLineSegments(mdastText(heading).trim(), fields).map(segment =>
      segment.setOff
        ? { type: "strong", children: [{ type: "text", value: segment.text }] }
        : { type: "text", value: segment.text },
    );
    tree.children.splice(i, 1);
    folded.push(heading);
  }
  return folded;
}

/**
 * Every h2 as the page renders it, in order: `{ text, adminLine }`, where
 * `adminLine` marks a heading the fold rebuilt from its employer line. Takes
 * markdown whose placeholders are already expanded (the body after
 * `expandResumePlaceholders`) and runs the plugin's own fold over it, so the
 * PDF verifier compares the printed page against the page's fold, not a copy
 * of it. Throws, as the build does, on an employer line that does not sit
 * directly below its role's heading.
 */
export function renderedHeadings(markdown) {
  const tree = fromMarkdown(markdown);
  const folded = new Set(foldAdminLines(tree));
  return tree.children
    .filter(node => node.type === "heading" && node.depth === 2)
    .map(node => ({ text: mdastText(node).trim(), adminLine: folded.has(node) }));
}

export function remarkResumeSections() {
  return (tree, file) => {
    const frontmatter = file?.data?.astro?.frontmatter;
    const isResumeSource = String(file?.path ?? "")
      .replaceAll("\\", "/")
      .endsWith(RESUME_SOURCE_SUFFIX);

    // Scope covers expansion, not just the typo guard. A *known* placeholder
    // shape in a blog post is still somebody's own comment: expanding it would
    // read `education` out of that post's frontmatter, find nothing, and fail
    // the build on an unrelated page.
    if (!isResumeSource) return;

    // Walk backwards: each expansion splices multiple nodes in place of one,
    // and a descending index keeps the remaining positions valid.
    for (let i = tree.children.length - 1; i >= 0; i--) {
      const node = tree.children[i];
      if (node.type !== "html") continue;

      let name;
      try {
        name = classifyPlaceholder(node.value);
      } catch (err) {
        // Placeholder-shaped but unknown, inside the resume: a typo, and a
        // build failure. Every other document returned above.
        throw expansionError(file, node, err);
      }
      if (!name) continue;

      let markdown;
      try {
        markdown = renderResumeSection(name, frontmatter);
      } catch (err) {
        throw expansionError(file, node, err);
      }

      // An empty expansion is a legitimate opt-out (every education item set to
      // render: false) — drop the placeholder and leave nothing behind.
      const replacement = markdown ? fromMarkdown(markdown).children : [];
      tree.children.splice(i, 1, ...replacement);
    }

    for (const { node, id } of headingIds(tree)) {
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };
    }

    foldAdminLines(tree, file);
  };
}
