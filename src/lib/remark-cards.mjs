import { visit } from "unist-util-visit";

// Transforms remark-directive `:::cards{.variant}` containers into card-row
// grids. Cards are separated by `---` (thematicBreak) inside the container —
// which means a card cannot itself contain a thematic break.
//
// Per-card slots (all optional):
//   - Media:  a leading image-only paragraph → <img class="card-media"> hoisted
//             out of its paragraph as a direct child of the card.
//   - Title:  any `###` heading → <h3 class="card-title">, retyped as a
//             paragraph node so remark-toc (which runs later) never sees it.
//   - Footer: a trailing emphasis-only paragraph → <figcaption class="card-footer">.
//             A card consisting ONLY of one emphasized line stays body text.
// A card with a media or footer slot renders as <figure class="card">,
// otherwise <div class="card">. A card with only a media slot (no footer)
// renders as <figure> without <figcaption>; the img alt text provides the
// accessible name in that case, which is valid per HTML5.
//
// `loading`/`decoding` img attributes are intentionally NOT set here —
// rehypeImageOptimization (src/lib/rehype-components.ts) adds them.
// `width`/`height` are also intentionally omitted — card images are public-path
// references (not imported assets), so Sharp metadata is unavailable at remark
// time. CLS is mitigated by `aspect-ratio: 1; width: 100%` in the card CSS.

const isImageParagraph = n =>
  n.type === "paragraph" && n.children.length === 1 && n.children[0].type === "image";
const isFooterParagraph = n =>
  n.type === "paragraph" && n.children.length === 1 && n.children[0].type === "emphasis";

function buildCard(group) {
  const children = [...group];
  let hasMedia = false;
  let hasFooter = false;

  if (children[0] && isImageParagraph(children[0])) {
    const img = children[0].children[0];
    img.data ??= {};
    img.data.hProperties ??= {};
    img.data.hProperties.className = ["card-media"];
    children[0] = img;
    hasMedia = true;
  }

  for (const child of children) {
    if (child.type === "heading" && child.depth === 3) {
      child.type = "paragraph";
      delete child.depth;
      child.data ??= {};
      child.data.hName = "h3";
      child.data.hProperties = { ...child.data.hProperties, className: ["card-title"] };
    }
  }

  const last = children.at(-1);
  if (last && last !== children[0] && isFooterParagraph(last)) {
    last.data ??= {};
    last.data.hName = "figcaption";
    last.data.hProperties = { ...last.data.hProperties, className: ["card-footer"] };
    hasFooter = true;
  }

  const isFigure = hasMedia || hasFooter;
  return {
    type: "cardsCard", // synthetic node; mdast-util-to-hast renders it via data.hName
    children,
    data: { hName: isFigure ? "figure" : "div", hProperties: { className: ["card"] } },
  };
}

export function remarkCards() {
  return tree => {
    visit(tree, "containerDirective", node => {
      if (node.name !== "cards") return;

      const groups = [[]];
      for (const child of node.children) {
        if (child.type === "thematicBreak") groups.push([]);
        else groups[groups.length - 1].push(child);
      }

      const variant = (node.attributes?.class ?? "").split(/\s+/).filter(Boolean);
      node.data ??= {};
      node.data.hName = "div";
      node.data.hProperties = { className: ["card-row", ...variant] };
      node.children = groups.filter(g => g.length).map(buildCard);
    });
  };
}
