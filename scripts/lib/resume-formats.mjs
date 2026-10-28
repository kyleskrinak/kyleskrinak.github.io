/**
 * The resume's .txt rendering, and the block model the .docx and .txt files
 * are both written from.
 *
 * All three files come from one render. resume-render.mjs lays out the print
 * route, and once the one-line and one-page checks have run against that
 * layout, extractResumeBlocks reads the same DOM into an ordered block list:
 *
 *   { kind: "name", runs }        the h1
 *   { kind: "contact", items, separators }
 *                                 one runs array per .contact-info item, and
 *                                 the separator printed before each
 *   { kind: "heading", runs }     an h2 — a role's admin line or a degree
 *   { kind: "paragraph", runs }   a scope paragraph
 *   { kind: "bullet", runs }      an accomplishment
 *
 * A run is { text, bold, underline, href }, plus font and fontSize (points)
 * where its face or size departs from its block's, all read from the computed
 * print styles, so formatting lands where the PDF prints it. Each block also
 * carries its print layout in points (font, size, line height, space above,
 * indent, alignment), measured from the page, so the .docx spacing follows
 * resume.css without restating it. Nothing here reads the markdown: a file
 * built from blocks carries exactly what the page printed, variant transforms
 * included.
 *
 * Each file is checked before anything is written. The blocks must account for
 * every character the page prints (verifyBlocksCoverPage), and each file must
 * read back to what it carries of the blocks: the .txt to their kind and text
 * (verifyResumeText here), the .docx to their text, bullets, bold, underline
 * and links (verifyResumeDocx in resume-docx.mjs).
 */

// Between contact items in all three files. The print stylesheet prints it in
// the PDF through ::before (src/styles/resume.css), and verifyBlocksCoverPage
// fails the render if the two differ.
export const CONTACT_SEPARATOR = " | ";

const MAX_REPORTED = 5;

/**
 * Read the rendered resume into blocks. Runs inside the page through
 * page.evaluate, which sends only this function's source text, so everything
 * it uses is declared inside it.
 *
 * Throws on any element the writers cannot represent rather than dropping it:
 * .resume-content may hold only h2, p and ul > li, and a block only text and
 * strong, b, a and span. The runs keep text, bold, underline, link, face and
 * size, and drop any other styling on those elements without an error.
 */
export function extractResumeBlocks() {
  // Inline elements whose formatting a run carries. Anything else inside a
  // block (em, code, br, img) would print in the PDF and vanish from the files.
  const INLINE = new Set(["STRONG", "B", "A", "SPAN"]);

  const header = document.querySelector(".resume-header");
  const content = document.querySelector(".resume-content");
  if (!header || !content) throw new Error("Resume header or content root not found");

  const hidden = el => getComputedStyle(el).display === "none";

  // CSS px to points. Measured after the print layout is applied, so these are
  // the PDF's distances.
  const PT = 0.75;

  // The face a style prints in: the first family in its stack, unquoted.
  const familyOf = style => style.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
  const pageLeft = header.getBoundingClientRect().left;
  let previousBottom = null;

  // Called once per block, in document order: the space above a block is the
  // distance from the previous block's bottom edge, so collapsed margins
  // measure as they print.
  function layoutOf(el) {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const fontSize = parseFloat(style.fontSize);
    const layout = {
      font: familyOf(style),
      fontSize: fontSize * PT,
      // "normal" parses as NaN; 1.2 is the usual browser value for it.
      lineHeight: (parseFloat(style.lineHeight) || fontSize * 1.2) * PT,
      spaceBefore: previousBottom === null ? 0 : Math.max(0, rect.top - previousBottom) * PT,
      indent: Math.max(0, rect.left - pageLeft) * PT,
      align: style.textAlign === "center" ? "center" : "left",
    };
    previousBottom = rect.bottom;
    return layout;
  }

  // layoutEl is the element whose layout the block's .docx paragraph copies:
  // the block itself, or .contact-info for a contact item.
  function runsOf(block, layoutEl = block) {
    const tag = block.tagName.toLowerCase();
    for (const el of block.querySelectorAll("*")) {
      if (!INLINE.has(el.tagName)) {
        throw new Error(
          `Unsupported <${el.tagName.toLowerCase()}> inside a resume <${tag}> — ` +
            `a block may hold only <strong>, <b>, <a> and <span>, the tags whose formatting the .docx carries.`
        );
      }
    }

    const layoutStyle = getComputedStyle(layoutEl);
    const layoutFont = familyOf(layoutStyle);
    const runs = [];
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      // HTML whitespace only: a no-break space prints, so it stays.
      const text = node.textContent.replace(/[ \t\n\r\f]+/g, " ");
      if (!text) continue;
      const parent = node.parentElement;
      const style = getComputedStyle(parent);
      const weight = style.fontWeight;
      const bold = weight === "bold" || Number(weight) >= 600;
      // text-decoration does not inherit as a computed value, but an ancestor's
      // underline still paints through its descendants, so walk up to the block.
      let underline = false;
      for (let el = parent; el; el = el === block ? null : el.parentElement) {
        if (getComputedStyle(el).textDecorationLine.includes("underline")) {
          underline = true;
          break;
        }
      }
      const link = parent.closest("a");
      const href = link && block.contains(link) ? link.href : null;
      const run = { text, bold, underline, href };
      // Face and size only where the run departs from its paragraph's layout;
      // the .docx sets every other run from that layout.
      const font = familyOf(style);
      if (font !== layoutFont) run.font = font;
      if (style.fontSize !== layoutStyle.fontSize) run.fontSize = parseFloat(style.fontSize) * PT;
      runs.push(run);
    }

    // Collapse whitespace across run boundaries and trim the block's ends, as
    // the browser does when it lays the text out, then merge neighbours that
    // print alike.
    const merged = [];
    for (const run of runs) {
      const prev = merged.at(-1);
      let text = run.text;
      if (!prev || prev.text.endsWith(" ")) text = text.replace(/^ /, "");
      if (!text) continue;
      if (
        prev &&
        prev.bold === run.bold &&
        prev.underline === run.underline &&
        prev.href === run.href &&
        prev.font === run.font &&
        prev.fontSize === run.fontSize
      ) {
        prev.text += text;
      } else {
        merged.push({ ...run, text });
      }
    }
    const last = merged.at(-1);
    if (last) {
      last.text = last.text.replace(/ $/, "");
      if (!last.text) merged.pop();
    }
    return merged;
  }

  const blocks = [];
  const push = (kind, el) => {
    const runs = runsOf(el);
    if (runs.length > 0) blocks.push({ kind, runs, layout: layoutOf(el) });
  };

  const name = header.querySelector("h1");
  if (!name) throw new Error("Resume header has no h1");
  push("name", name);

  // The text a ::before rule prints. innerText leaves generated content out,
  // so the contact separator is read here and checked on its own.
  function beforeText(el) {
    const content = getComputedStyle(el, "::before").content;
    const quoted = /^"(.*)"$/s.exec(content ?? "");
    return quoted ? quoted[1].replace(/\\(.)/gs, "$1") : "";
  }

  const contact = header.querySelector(".contact-info");
  if (contact && !hidden(contact)) {
    const items = [];
    const separators = [];
    for (const el of contact.children) {
      if (hidden(el)) continue;
      const runs = runsOf(el, contact);
      if (runs.length === 0) continue;
      items.push(runs);
      separators.push(beforeText(el));
    }
    if (items.length > 0) blocks.push({ kind: "contact", items, separators, layout: layoutOf(contact) });
  }

  for (const el of content.children) {
    if (hidden(el)) continue;
    if (el.tagName === "H2") push("heading", el);
    else if (el.tagName === "P") push("paragraph", el);
    else if (el.tagName === "UL") {
      for (const li of el.children) {
        if (li.tagName !== "LI") {
          throw new Error(`Unsupported <${li.tagName.toLowerCase()}> inside a resume <ul>`);
        }
        if (!hidden(li)) push("bullet", li);
      }
    } else {
      throw new Error(
        `Unsupported <${el.tagName.toLowerCase()}> in .resume-content — ` +
          `the .docx and .txt writers handle h2, p and ul > li only.`
      );
    }
  }

  // What the page prints, for verifyBlocksCoverPage. innerText follows the
  // print layout: display:none text and list markers are not in it.
  const pageText = `${header.innerText}\n${content.innerText}`;
  return { blocks, pageText };
}

export function runsText(runs) {
  return runs.map(run => run.text).join("");
}

// Join neighbouring runs that match on what the .docx read-back compares (bold,
// underline, link; readDocxParagraphs reads no face or size), so the blocks and
// the .docx still compare equal when they split one stretch of text into
// different runs.
export function mergeRuns(runs) {
  const merged = [];
  for (const { text, bold, underline, href } of runs) {
    const prev = merged.at(-1);
    if (prev && prev.bold === bold && prev.underline === underline && prev.href === href) prev.text += text;
    else merged.push({ text, bold, underline, href });
  }
  return merged;
}

function blockRuns(block) {
  return block.kind === "contact" ? block.items.flat() : block.runs;
}

// A block as one line of text: what the .txt file prints and the .docx
// paragraph holds.
export function blockText(block) {
  return block.kind === "contact"
    ? block.items.map(runsText).join(CONTACT_SEPARATOR)
    : runsText(block.runs);
}

/**
 * Problems, if any, with the blocks as a record of the printed page. Compared
 * with all whitespace removed: the layout decides spacing, the blocks decide
 * content, and a dropped word, a hidden element read as text, or CSS
 * text-transform each shows up as a difference here. The contact separators
 * are generated content, outside pageText, so they are compared on their own:
 * the page must print CONTACT_SEPARATOR between items, exactly as the .docx
 * and .txt do.
 */
export function verifyBlocksCoverPage({ blocks, pageText }) {
  const problems = [];
  const contact = blocks.find(block => block.kind === "contact");
  if (contact) {
    const expected = contact.items.map((_, i) => (i === 0 ? "" : CONTACT_SEPARATOR));
    if (JSON.stringify(contact.separators) !== JSON.stringify(expected)) {
      problems.push(
        `The printed contact separators ${JSON.stringify(contact.separators)} differ from ` +
          `CONTACT_SEPARATOR ${JSON.stringify(CONTACT_SEPARATOR)}, which the .docx and .txt ` +
          `print; src/styles/resume.css sets the printed one.`
      );
    }
  }

  const squash = s => s.replace(/\s+/g, "");
  const extracted = squash(blocks.flatMap(blockRuns).map(run => run.text).join(""));
  const printed = squash(pageText);
  if (extracted === printed) return problems;
  let i = 0;
  while (i < extracted.length && extracted[i] === printed[i]) i++;
  const around = s => JSON.stringify(s.slice(Math.max(0, i - 30), i + 30));
  return [
    ...problems,
    `The .docx/.txt content differs from the printed page at character ${i} ` +
      `(whitespace ignored):\n  page:      ${around(printed)}\n  extracted: ${around(extracted)}`,
  ];
}

/**
 * Plain text, one line per block: the name, the contact line, then each heading
 * after a blank line, its scope paragraph, and its bullets as "- " lines. No
 * hard wraps, LF endings, a final newline, no BOM; the deploy serves it as
 * UTF-8, so dashes and accents stay as they print.
 */
export function buildResumeText(blocks) {
  const lines = [];
  for (const block of blocks) {
    if (block.kind === "heading") lines.push("");
    lines.push(block.kind === "bullet" ? `- ${blockText(block)}` : blockText(block));
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Read a .txt resume back into text records, by the layout alone: the lines
 * before the first blank line are the name and the contact line, a line after
 * a blank line is a heading, a "- " line is a bullet, and any other line is a
 * paragraph. Knows nothing of the blocks it was written from, so a block whose
 * text the layout cannot carry (a paragraph that opens with "- ", a contact
 * item holding the separator, a stray line break) reads back as something else.
 */
export function parseResumeText(text) {
  const lines = text.replace(/\n$/, "").split("\n");
  const firstBlank = lines.indexOf("");
  const headerLines = firstBlank === -1 ? lines.length : firstBlank;
  const records = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0) records.push({ kind: "name", text: line });
    else if (i === 1 && i < headerLines) records.push({ kind: "contact", items: line.split(CONTACT_SEPARATOR) });
    else if (line === "") records.push({ kind: "heading", text: lines[++i] ?? "" });
    else if (line.startsWith("- ")) records.push({ kind: "bullet", text: line.slice(2) });
    else records.push({ kind: "paragraph", text: line });
  }
  return records;
}

// The blocks as the text records parseResumeText returns.
function textRecords(blocks) {
  return blocks.map(block =>
    block.kind === "contact"
      ? { kind: block.kind, items: block.items.map(runsText) }
      : { kind: block.kind, text: runsText(block.runs) }
  );
}

/**
 * Compare record lists position by position. Returns problem strings, listing
 * at most MAX_REPORTED differences so one early shift does not flood the log.
 */
export function compareRecords(expected, actual, label) {
  const differences = [];
  const length = Math.max(expected.length, actual.length);
  for (let i = 0; i < length; i++) {
    const want = JSON.stringify(expected[i] ?? null);
    const got = JSON.stringify(actual[i] ?? null);
    if (want !== got) differences.push(`  - block ${i}: expected ${want}\n               read back ${got}`);
  }
  if (differences.length === 0) return [];
  const shown = differences.slice(0, MAX_REPORTED);
  const more = differences.length - shown.length;
  return [
    `${label} does not read back to the printed page's content ` +
      `(${expected.length} blocks expected, ${actual.length} read back):\n` +
      shown.join("\n") +
      (more > 0 ? `\n  …and ${more} more` : ""),
  ];
}

export function verifyResumeText(blocks, text) {
  const problems = [];
  if (text.startsWith("﻿")) problems.push(".txt starts with a byte-order mark");
  if (text.includes("\r")) problems.push(".txt contains a carriage return; lines must end in LF");
  if (!text.endsWith("\n")) problems.push(".txt does not end with a newline");
  return [...problems, ...compareRecords(textRecords(blocks), parseResumeText(text), ".txt")];
}

// ---------------------------------------------------------------------------
// Command-line formats, shared by print-resume-pdf.mjs and
// build-resume-variant.mjs.

export const FORMATS = ["pdf", "docx", "txt"];

/**
 * Parse a --formats value ("pdf,docx,txt") into a deduplicated list in FORMATS
 * order. Throws on an empty list or an unknown format.
 */
export function parseFormats(value) {
  const requested = value
    .split(",")
    .map(format => format.trim().toLowerCase())
    .filter(Boolean);
  const unknown = requested.filter(format => !FORMATS.includes(format));
  if (unknown.length > 0) {
    throw new Error(`Unknown --formats value(s): ${unknown.join(", ")} (expected ${FORMATS.join(", ")})`);
  }
  if (requested.length === 0) throw new Error(`--formats is empty (expected ${FORMATS.join(", ")})`);
  return FORMATS.filter(format => requested.includes(format));
}

/**
 * The output path for each requested format: the .pdf path, and the other
 * formats beside it under the same base name. Throws unless the path ends in
 * .pdf, so a typo cannot write "resume.docx.docx" or overwrite a file named
 * like a format.
 */
export function outputPaths(pdfPath, formats) {
  if (!/\.pdf$/i.test(pdfPath)) throw new Error(`--output must end in .pdf (got ${pdfPath})`);
  const base = pdfPath.slice(0, -".pdf".length);
  return Object.fromEntries(formats.map(format => [format, format === "pdf" ? pdfPath : `${base}.${format}`]));
}
