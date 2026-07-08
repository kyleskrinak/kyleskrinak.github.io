import { visit } from "unist-util-visit";
// Facet vocabulary — single source of truth, also imported by
// scripts/build-resume-variant.mjs to validate variant configs.
export const FACETS = new Set(["leadership", "platform-ops", "security", "web-dev", "creative", "cost", "delivery"]);
const TAG_RE = /^<!--\s*f:\s*([a-z0-9,\s-]+?)\s*-->$/;
const FACET_TAG_PREFIX_RE = /^<!--\s*f\s*:/;

function failFacet(file, node, message) {
  if (file?.fail) file.fail(message, node);
  throw new Error(message);
}

function parseFacetTag(raw, file, node) {
  const m = TAG_RE.exec(raw);
  if (!m) {
    if (FACET_TAG_PREFIX_RE.test(raw)) {
      failFacet(file, node, `[remark-facets] ${file?.path ?? "unknown file"}: malformed facet tag "${raw}"`);
    }
    return null;
  }

  const facets = m[1].split(",").map(s => s.trim());
  if (facets.some(f => f.length === 0)) {
    failFacet(file, node, `[remark-facets] ${file?.path ?? "unknown file"}: malformed facet tag "${raw}"`);
  }
  const unknown = facets.filter(f => !FACETS.has(f));
  if (unknown.length) {
    failFacet(file, node, `[remark-facets] ${file?.path ?? "unknown file"}: unknown facet(s) ${unknown.join(", ")}`);
  }
  return facets;
}

export function remarkFacets() {
  return (tree, file) => {
    // 1) Facet tags: the comment is a child of the listItem's LAST paragraph (verified),
    //    NOT of the listItem itself.
    visit(tree, "listItem", (li) => {
      const para = li.children.filter(c => c.type === "paragraph").at(-1);
      if (!para) return;
      const last = para.children.at(-1);
      if (!last || last.type !== "html") return;
      const facets = parseFacetTag(last.value, file, last);
      if (!facets) return; // unrelated comment — leave inert
      para.children.pop(); // position-based removal, never string replace
      const prev = para.children.at(-1);
      if (prev?.type === "text") prev.value = prev.value.trimEnd(); // REQUIRED: else tagged bullets gain a trailing space
      li.data ??= {}; li.data.hProperties ??= {};
      li.data.hProperties["data-facets"] = facets.join(" "); // space-separated -> [data-facets~=x]
    });

    // 2) Scope paragraph tags: same trailing-comment syntax; comment is an inline child of the
    //    paragraph (not a sibling). Only root-level paragraphs to avoid double-processing
    //    listItem paragraphs (which the listItem visitor already handled).
    visit(tree, "paragraph", (para, _idx, parent) => {
      if (parent?.type !== "root") return;
      const last = para.children.at(-1);
      if (!last || last.type !== "html") return;
      const facets = parseFacetTag(last.value, file, last);
      if (!facets) return;
      para.children.pop();
      const prev = para.children.at(-1);
      if (prev?.type === "text") prev.value = prev.value.trimEnd();
      para.data ??= {}; para.data.hProperties ??= {};
      para.data.hProperties["data-facets"] = facets.join(" ");
    });

  };
}
