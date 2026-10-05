import { fromMarkdown } from "mdast-util-from-markdown";
import { PLACEHOLDER_RE, renderResumeSection } from "./resume-sections.mjs";

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
 * Inert on every other page — a document with no placeholder node is untouched,
 * so this runs harmlessly across the whole content collection.
 */
export function remarkResumeSections() {
  return (tree, file) => {
    const frontmatter = file?.data?.astro?.frontmatter;

    // Walk backwards: each expansion splices multiple nodes in place of one,
    // and a descending index keeps the remaining positions valid.
    for (let i = tree.children.length - 1; i >= 0; i--) {
      const node = tree.children[i];
      if (node.type !== "html") continue;
      const match = PLACEHOLDER_RE.exec(node.value.trim());
      if (!match) continue;

      let markdown;
      try {
        markdown = renderResumeSection(match[1], frontmatter);
      } catch (err) {
        const where = file?.path ?? "unknown file";
        const message = `[remark-resume-sections] ${where}: ${err.message}`;
        if (file?.fail) file.fail(message, node);
        throw new Error(message);
      }

      // An empty expansion is a legitimate opt-out (every education item set to
      // render: false) — drop the placeholder and leave nothing behind.
      const replacement = markdown ? fromMarkdown(markdown).children : [];
      tree.children.splice(i, 1, ...replacement);
    }
  };
}
