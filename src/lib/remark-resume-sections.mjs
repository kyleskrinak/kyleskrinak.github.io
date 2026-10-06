import { fromMarkdown } from "mdast-util-from-markdown";
import { classifyPlaceholder, renderResumeSection } from "./resume-sections.mjs";

/**
 * Expands the resume's section placeholders (`<!-- current-role -->`,
 * `<!-- education -->`) into real headings and employer lines built from the
 * page's frontmatter.
 *
 * The section markdown comes from src/lib/resume-sections.mjs, the same module
 * the Node scripts use, so the rendered page, the PDF content verifier, the
 * resume linter, and the variant builder's entry-id derivation all expand to
 * identical text. Parsing that markdown (rather than hand-building MDAST) is
 * what guarantees it: there is one rendered form, not two implementations of it.
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
  };
}
