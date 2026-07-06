import { visit } from "unist-util-visit"; // transitive dep; if unresolvable, walk children manually
const FACETS = new Set(["leadership", "platform-ops", "security", "web-dev", "creative", "cost", "delivery"]); // Kyle confirms
const TAG_RE = /^<!--\s*f:\s*([a-z0-9,\s-]+?)\s*-->$/;

export function remarkFacets() {
  return (tree, file) => {
    // 1) Facet tags: the comment is a child of the listItem's LAST paragraph (verified),
    //    NOT of the listItem itself.
    visit(tree, "listItem", (li) => {
      const para = li.children.filter(c => c.type === "paragraph").at(-1);
      if (!para) return;
      const last = para.children.at(-1);
      if (!last || last.type !== "html") return;
      const m = TAG_RE.exec(last.value);
      if (!m) return; // unrelated comment — leave inert
      const facets = m[1].split(",").map(s => s.trim()).filter(Boolean);
      const unknown = facets.filter(f => !FACETS.has(f));
      if (unknown.length) {
        console.warn(`[remark-facets] ${file.path}: unknown facet(s) ${unknown.join(", ")} — tag left inert`);
        return; // leave the comment; it renders invisibly
      }
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
      const m = TAG_RE.exec(last.value);
      if (!m) return;
      const facets = m[1].split(",").map(s => s.trim()).filter(Boolean);
      const unknown = facets.filter(f => !FACETS.has(f));
      if (unknown.length) {
        console.warn(`[remark-facets] ${file.path}: unknown facet(s) ${unknown.join(", ")} — tag left inert`);
        return;
      }
      para.children.pop();
      const prev = para.children.at(-1);
      if (prev?.type === "text") prev.value = prev.value.trimEnd();
      para.data ??= {}; para.data.hProperties ??= {};
      para.data.hProperties["data-facets"] = facets.join(" ");
    });

  };
}
