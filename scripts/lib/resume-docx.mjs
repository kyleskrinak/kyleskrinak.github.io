/**
 * The resume's .docx rendering, written from the blocks resume-formats.mjs
 * reads out of the printed page, then read back to prove it carries them.
 *
 * Each paragraph copies its block's print layout (font, size, exact line
 * height, space above, indent, alignment) and the section copies the @page
 * margins, so a word processor lays out the lines the PDF prints. Bold,
 * underline, links, and any face or size that departs from the block's come
 * from the runs. The contact items share one line, separated by
 * CONTACT_SEPARATOR, as in the .txt file.
 *
 * verifyResumeDocx unzips the file and reads word/document.xml with a small
 * tokenizer: each paragraph's text, whether it is a list item, and its bold,
 * underlined and linked stretches. Those must match the blocks, so a writer
 * change that drops text, bold, underline or a link fails the render instead
 * of shipping. The read-back does not check face or size; the unit tests in
 * resume-docx.test.mjs cover those.
 */

import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  LevelFormat,
  LineRuleType,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import JSZip from "jszip";
import { CONTACT_SEPARATOR, blockText, compareRecords, mergeRuns } from "./resume-formats.mjs";

const BULLETS = "resume-bullets";
// Letter, as resume.css's @page sets it; applyPrintLayout fails on any other size.
const PAGE_PT = { width: 612, height: 792 };
// How far left of the bullet text the marker hangs.
const HANGING_PT = 10;

const twips = pt => Math.round(pt * 20);
const halfPoints = pt => Math.round(pt * 2);

// A block's runs as one paragraph: a contact block's items joined by the separator.
function paragraphRuns(block) {
  if (block.kind !== "contact") return block.runs;
  const separator = { text: CONTACT_SEPARATOR, bold: false, underline: false, href: null };
  return block.items.flatMap((runs, i) => (i === 0 ? runs : [separator, ...runs]));
}

function textRun(run, layout) {
  return new TextRun({
    text: run.text,
    bold: run.bold,
    underline: run.underline ? {} : undefined,
    font: run.font ?? layout.font,
    size: halfPoints(run.fontSize ?? layout.fontSize),
    color: "000000",
  });
}

function paragraph(block) {
  const { layout } = block;
  const bullet = block.kind === "bullet";
  let indent;
  if (bullet) indent = { left: twips(layout.indent), hanging: twips(HANGING_PT) };
  else if (layout.indent > 0) indent = { left: twips(layout.indent) };
  return new Paragraph({
    children: paragraphRuns(block).map(run =>
      run.href
        ? new ExternalHyperlink({ link: run.href, children: [textRun(run, layout)] })
        : textRun(run, layout)
    ),
    alignment: layout.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
    // Exact rather than a multiple: Word multiplies the font's own line gap,
    // which runs taller than CSS line-height, and the page would not fit.
    spacing: {
      before: twips(layout.spaceBefore),
      after: 0,
      line: twips(layout.lineHeight),
      lineRule: LineRuleType.EXACT,
    },
    indent,
    numbering: bullet ? { reference: BULLETS, level: 0 } : undefined,
  });
}

/**
 * The .docx file as a Buffer. `margins` are the @page margins in points, from
 * the same render.
 */
export async function buildResumeDocx(blocks, { margins }) {
  const nameBlock = blocks.find(block => block.kind === "name");
  if (!nameBlock) throw new Error("Resume blocks have no name block");
  const name = blockText(nameBlock);
  // Body text sets the defaults the bullet markers inherit.
  const body = (blocks.find(block => block.kind === "bullet") ?? blocks[0]).layout;
  const doc = new Document({
    // The docx package fills an unset author with "Un-named".
    title: name,
    creator: name,
    lastModifiedBy: name,
    styles: {
      default: {
        document: { run: { font: body.font, size: halfPoints(body.fontSize), color: "000000" } },
      },
    },
    numbering: {
      config: [
        {
          reference: BULLETS,
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT }],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: twips(PAGE_PT.width), height: twips(PAGE_PT.height) },
            margin: {
              top: twips(margins.top),
              right: twips(margins.right),
              bottom: twips(margins.bottom),
              left: twips(margins.left),
            },
          },
        },
        children: blocks.map(paragraph),
      },
    ],
  });
  return Packer.toBuffer(doc);
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, code) => {
    if (code[0] !== "#") return ENTITIES[code] ?? match;
    return String.fromCodePoint(
      code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1))
    );
  });
}

function attribute(tag, name) {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? decodeXml(m[1]) : null;
}

// A run property that is on: present, and not switched off by its w:val.
function propertyOn(rPr, element) {
  const m = new RegExp(`<w:${element}(\\s[^>]*)?/>`).exec(rPr);
  if (!m) return false;
  const value = m[1] ? attribute(m[1], "w:val") : null;
  return element === "u" ? value !== "none" : !["false", "0", "off"].includes(value);
}

/**
 * The body paragraphs of a .docx file, in order, as { bullet, runs }. Reads the
 * markup the docx package writes (no tables, no nested paragraphs); it is a
 * check on this module's own output, not a general .docx reader.
 */
export async function readDocxParagraphs(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const read = name => {
    const file = zip.file(name);
    if (!file) throw new Error(`no ${name} in the archive`);
    return file.async("string");
  };
  const xml = await read("word/document.xml");
  const rels = await read("word/_rels/document.xml.rels");

  const targets = new Map();
  for (const [tag] of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    targets.set(attribute(tag, "Id"), attribute(tag, "Target"));
  }

  const body = /<w:body>([\s\S]*)<\/w:body>/.exec(xml)?.[1];
  if (body == null) throw new Error("word/document.xml has no <w:body>");

  const paragraphs = [];
  for (const [, inner] of body.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)) {
    const runs = [];
    let href = null;
    const tokens = /<w:hyperlink\b([^>]*)>|<\/w:hyperlink>|<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g;
    for (const [token, linkAttributes, run] of inner.matchAll(tokens)) {
      if (token.startsWith("</w:hyperlink")) {
        href = null;
      } else if (token.startsWith("<w:hyperlink")) {
        const id = attribute(linkAttributes, "r:id");
        href = targets.get(id) ?? `(no relationship ${id})`;
      } else {
        const rPr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(run)?.[1] ?? "";
        let text = "";
        const pieces = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br(?:\s[^>]*)?\/>/g;
        for (const [piece, value] of run.matchAll(pieces)) {
          if (piece.startsWith("<w:tab")) text += "\t";
          else if (piece.startsWith("<w:br")) text += "\n";
          else text += decodeXml(value);
        }
        if (text) runs.push({ text, bold: propertyOn(rPr, "b"), underline: propertyOn(rPr, "u"), href });
      }
    }
    paragraphs.push({ bullet: /<w:numPr>/.test(inner), runs: mergeRuns(runs) });
  }
  return paragraphs;
}

export async function verifyResumeDocx(blocks, buffer) {
  let paragraphs;
  try {
    paragraphs = await readDocxParagraphs(buffer);
  } catch (err) {
    return [`.docx could not be read back: ${err.message}`];
  }
  const expected = blocks.map(block => ({
    bullet: block.kind === "bullet",
    runs: mergeRuns(paragraphRuns(block)),
  }));
  return compareRecords(expected, paragraphs, ".docx");
}
