/**
 * Resume section expansion — the single source of truth for every resume
 * section that renders from frontmatter data rather than hand-written body text.
 *
 * The resume body carries a top-level HTML comment placeholder where a
 * data-driven section belongs:
 *
 *   <!-- current-role -->   → the lead h2 + employer line, from `current_role`
 *   <!-- education -->      → one h2 + employer line (+ honors) per rendered
 *                             `education.items` entry
 *
 * Everything that reads the resume expands these placeholders through this one
 * module, so the markdown source, the rendered page, the PDF verifier, the
 * content linter, and the variant builder's entry-id derivation can never
 * disagree about what a section says:
 *
 *   src/lib/remark-resume-sections.mjs  → the rendered page and PDF
 *   scripts/lib/resume-source.mjs       → every Node consumer
 *
 * This module stays pure (no fs, no yaml) so both sides can import it.
 *
 * Dates: both callers hand us RAW frontmatter — the remark plugin reads
 * `file.data.astro.frontmatter`, the scripts parse the YAML themselves — so the
 * schema's `z.coerce.date()` has not run by the time a value arrives here. A
 * plain "YYYY-MM-DD" string is the ordinary case. A Date is accepted too,
 * because a YAML parser may hand back a timestamp and a caller holding
 * schema-validated data may pass one; it is read in UTC so a local timezone can
 * never shift the rendered month.
 */

/** Placeholder names this module knows how to expand. */
export const RESUME_SECTIONS = ["current-role", "education"];

/**
 * A placeholder occupies a whole line: `<!-- education -->`. Anchored and
 * name-restricted so an unrelated HTML comment in the body stays inert. The
 * padding is `\s*`, which matches a newline — `classifyPlaceholder` enforces the
 * single-line half of the contract, for the reason stated there.
 */
export const PLACEHOLDER_RE = new RegExp(
  `^<!--\\s*(${RESUME_SECTIONS.join("|")})\\s*-->$`,
);

/**
 * Catches a placeholder-shaped comment whose name is NOT in RESUME_SECTIONS,
 * so a typo (`<!-- educaton -->`) fails the build instead of rendering nothing.
 * Deliberately narrow: only a single hyphenated lowercase word looks like a
 * placeholder, so facet tags (`<!-- f: … -->`) and multi-word notes
 * (`<!-- TODO revisit -->`) never match. A single-word note does — `<!-- draft -->`
 * in the resume throws. That is the cost of catching the typo, and it only
 * applies inside the resume source; see remark-resume-sections.mjs.
 */
const PLACEHOLDER_SHAPED_RE = /^<!--\s*([a-z][a-z0-9-]*)\s*-->$/;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** En dash with spaces — the date-range separator the resume body already uses. */
const RANGE_DASH = "–";
/** Em dash with spaces — the employer/location separator every employer line uses. */
const EMPLOYER_DASH = "—";

function fail(message) {
  throw new Error(`[resume-sections] ${message}`);
}

/**
 * Classify one candidate placeholder — a body line, or an mdast html node's
 * value — so both expansion paths decide identically what counts as one.
 *
 * Returns the section name for a known placeholder, `null` for anything that is
 * not placeholder-shaped, and throws for a placeholder-shaped comment whose name
 * is unknown. The caller decides whether that throw applies: in the resume a
 * typo is a build failure, while in any other document the same shape is
 * somebody's ordinary HTML comment.
 */
export function classifyPlaceholder(value) {
  const trimmed = String(value).trim();
  // A placeholder occupies one line, and the two callers do not hand over the
  // same unit: mdast gives a whole HTML block, so `<!--\neducation\n-->` arrives
  // as one value, while expandResumePlaceholders splits the body on newlines and
  // can never assemble it. Both regexes below spell their padding `\s*`, which
  // matches a newline, so without this guard the mdast path expands a multiline
  // comment into headings the string path leaves alone — and a multiline typo
  // throws on one path and passes on the other. Returning null is what makes
  // them agree: an ordinary comment on both, which is already the string path's
  // answer. Throwing here would invert the divergence instead of closing it.
  if (/[\r\n]/.test(trimmed)) return null;
  const match = PLACEHOLDER_RE.exec(trimmed);
  if (match) return match[1];
  const shaped = PLACEHOLDER_SHAPED_RE.exec(trimmed);
  if (shaped) {
    fail(
      `unknown section placeholder "<!-- ${shaped[1]} -->" — known sections: ${RESUME_SECTIONS.join(", ")}`,
    );
  }
  return null;
}

/**
 * "2022-06-01" | Date → "June 2022". Throws rather than returning a partial
 * date: a silently wrong month on the resume is worse than a failed build. The
 * string match is anchored at BOTH ends for that reason — a prefix match reads
 * "2022-060" and "2022-06-not-a-date" as June 2022, and neither caller would
 * notice, since both read raw YAML with the collection schema's date coercion
 * never applied and PDF verification compares against whatever got rendered.
 *
 * The optional day is validated against the month and the year for the same
 * reason, even though it never reaches the output: "2023-02-29" and "2022-06-00"
 * are not dates, and a renderer that accepts them is the one place a typo in the
 * source could survive every check downstream.
 */
export function formatMonthYear(value, label) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) fail(`${label}: invalid Date`);
    return `${MONTHS[value.getUTCMonth()]} ${value.getUTCFullYear()}`;
  }
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value.trim());
    if (!m) fail(`${label}: expected YYYY-MM or YYYY-MM-DD, got "${value}"`);
    const month = Number(m[2]);
    if (month < 1 || month > 12) fail(`${label}: month out of range in "${value}"`);
    if (m[3] !== undefined) {
      const day = Number(m[3]);
      // Day 0 of the following month is the last day of this one, which settles
      // February in a leap year without a rule of its own.
      const lastDay = new Date(Date.UTC(Number(m[1]), month, 0)).getUTCDate();
      if (day < 1 || day > lastDay) {
        fail(`${label}: day out of range for that month in "${value}"`);
      }
    }
    return `${MONTHS[month - 1]} ${m[1]}`;
  }
  return fail(`${label}: expected a date string or Date, got ${typeof value}`);
}

/**
 * The employer line convention every resume section follows:
 *   **Employer** — Location | Dates
 *
 * Both tail fields are required: `isEmployerLine` below identifies the line by
 * its em dash, its pipe and its digits, and resume-render.mjs and
 * lint-resume.mjs both recognize employer lines through it — so a line missing
 * either field would silently stop being recognized as one.
 */
function employerLine(employer, location, dates, label) {
  if (!employer?.trim()) fail(`${label}: employer is required`);
  if (!location?.trim()) fail(`${label}: location is required to build the employer line`);
  if (!dates?.trim()) fail(`${label}: dates are required to build the employer line`);
  const line = `**${employer.trim()}** ${EMPLOYER_DASH} ${location.trim()} | ${dates.trim()}`;
  // The producer checks its own output against the recognizer below it. Three
  // non-empty fields are not sufficient: EMPLOYER_LINE_RE requires a digit after
  // the pipe, so `years: "Ongoing"` builds a line resume-render.mjs drops from
  // its PDF expectations — `readExpectedContent` maps every body line through
  // `employerLineText` and filters the nulls, and its `length === 0` guard
  // cannot fire while other employer lines survive. The institution, location
  // and dates would stop being verified while the heading kept passing.
  if (!EMPLOYER_LINE_RE.test(line)) {
    fail(
      `${label}: "${line}" is not a recognized employer line — dates must contain a digit, as in "2019" or "expected 2027"`,
    );
  }
  return line;
}

/**
 * The recognizer for the line `employerLine` above produces, kept beside it so
 * the convention is written down once.
 *
 * Two consumers need it and need it to agree: lint-resume.mjs skips the line
 * when it collects scope prose, and resume-render.mjs turns it into a PDF
 * content expectation. The capture groups give the name and the location/dates
 * tail separately.
 *
 * No `/g` flag, on purpose: a shared global regex carries `lastIndex` between
 * callers, so a `.test()` and a `matchAll()` on the same object silently skip
 * matches.
 */
const EMPLOYER_LINE_RE = new RegExp(
  `^\\*\\*(.+?)\\*\\*\\s*${EMPLOYER_DASH}\\s*(.*\\|.*\\d.*)$`,
);

/** True for a body line that follows the employer-line convention. */
export function isEmployerLine(line) {
  return EMPLOYER_LINE_RE.test(line.trim());
}

/**
 * The employer line as the page renders it — bold markers stripped, so a caller
 * can compare it against DOM or PDF text. Returns null for any other line.
 */
export function employerLineText(line) {
  const match = EMPLOYER_LINE_RE.exec(line.trim());
  if (!match) return null;
  return `${match[1].trim()} ${EMPLOYER_DASH} ${match[2].trim()}`;
}

/**
 * The lead section: heading and employer line only. The scope paragraph and
 * the facet-tagged bullets below it stay hand-written in the body — this
 * placeholder replaces the two lines that restate structured facts.
 */
export function renderCurrentRole(currentRole) {
  if (!currentRole) fail("<!-- current-role --> is present but `current_role` is missing from the frontmatter");
  const { title, employer, location, start_date: startDate } = currentRole;
  if (!title?.trim()) fail("current_role.title is required");
  const dates = `${formatMonthYear(startDate, "current_role.start_date")} ${RANGE_DASH} Present`;
  return [
    `## ${title.trim()}`,
    "",
    employerLine(employer, location, dates, "current_role"),
  ].join("\n");
}

function renderEducationItem(item, idx) {
  const label = `education.items[${idx}]`;
  const heading = (item.degree_abbr ?? item.degree ?? "").trim();
  if (!heading) fail(`${label}: degree is required`);
  const lines = [
    `## ${heading}`,
    "",
    employerLine(item.institution, item.location, item.years, label),
  ];
  if (item.honors?.trim()) lines.push("", item.honors.trim());
  return lines.join("\n");
}

/**
 * One section per education item whose `render` flag is literally true.
 *
 * Rendering is opt-in: this module requires the flag rather than inferring it,
 * so an item recorded without `render: true` stays in the frontmatter and off
 * the page. (The schema states the same default, but it never reaches here —
 * see the Dates note at the top: both callers pass raw frontmatter.) A
 * zero-item expansion is therefore the author's explicit choice and expands to
 * nothing. A missing `education` object, by contrast, means the placeholder
 * points at data that does not exist — that throws.
 *
 * `items` carries no fallback, for that same distinction: the schema requires
 * the key, so only the raw-YAML callers can reach a missing or null `items`, and
 * a default of `[]` would read that absence as the authored empty array. PDF
 * generation would then expect no education heading and no employer line and
 * pass, which is the failure this module exists to make loud.
 *
 * Every item is validated before the opt-in filter runs, for the same reason:
 * the filter cannot tell a malformed item from a deliberate opt-out, so a
 * non-mapping item or a non-boolean `render` throws rather than silently
 * removing its section. An omitted flag and a literal `false` stay opt-outs.
 */
export function renderEducation(education) {
  if (!education) fail("<!-- education --> is present but `education` is missing from the frontmatter");
  const items = education.items;
  if (!Array.isArray(items)) fail("education.items must be an array");
  // Validate every item, including the ones about to be filtered out. The filter
  // below asks only whether `render` is literally true, so a malformed item is
  // indistinguishable from the two deliberate opt-outs — an omitted flag and a
  // literal `false`. `items: [null]`, a bare string, and `render: "true"`, `1` or
  // `null` all read as "skip": the section leaves the PDF content expectations
  // and `resume-render.mjs` verifies a page that never carried it. The schema
  // rejects all of these (`z.boolean().default(false)` defaults `undefined`
  // only, never `null`), and both callers here read raw frontmatter, so nothing
  // else checks them.
  items.forEach((item, idx) => {
    const label = `education.items[${idx}]`;
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      fail(`${label}: must be a mapping, not ${JSON.stringify(item) ?? typeof item}`);
    }
    if (item.render !== undefined && typeof item.render !== "boolean") {
      fail(`${label}.render: must be true or false when present, not ${JSON.stringify(item.render)}`);
    }
  });
  return items
    .map((item, idx) => [item, idx])
    .filter(([item]) => item.render === true)
    .map(([item, idx]) => renderEducationItem(item, idx))
    .join("\n\n");
}

/**
 * The resume's meta description, for both the public route and the print route.
 *
 * `current_role.title` supplies the lead sentence so the role is stated in one
 * place only; the frontmatter `description` carries the career summary that no
 * structured field can derive. Either part alone is a valid description.
 */
export function resumeMetaDescription(data) {
  const role = data?.current_role?.title?.trim().replace(/\.+$/, "");
  const summary = data?.description?.trim();
  const parts = [role, summary].filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts.join(". ");
}

const RENDERERS = {
  "current-role": renderCurrentRole,
  education: renderEducation,
};

/**
 * Expand one placeholder name against frontmatter data. Returns the section's
 * markdown — the same text the remark plugin parses into MDAST, so the string
 * form and the rendered form are always the same content.
 */
export function renderResumeSection(name, data) {
  const render = RENDERERS[name];
  if (!render) fail(`unknown resume section "${name}"`);
  if (name === "current-role") return render(data?.current_role);
  return render(data?.education);
}

/** Opens or closes a fenced code block: up to three spaces, then the fence. */
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
/**
 * Opens a CommonMark HTML block of the comment kind: up to three spaces, then
 * `<!--`. The block runs to the first line containing `-->`, and nothing inside
 * it opens anything else — a fence least of all, which is the whole reason this
 * state exists. Without it, three backticks inside a multiline comment opened a
 * fence the string path never closed, so every placeholder after that comment
 * looked like sample text while remark, reading the comment as one HTML block,
 * expanded them.
 */
const COMMENT_OPEN_RE = /^ {0,3}<!--/;
/** Ends that block, on the same line it started or any line after. */
const COMMENT_CLOSE = "-->";
/**
 * Four columns of indentation start an indented code block in CommonMark. Four
 * spaces reach it, and so does a tab — including a tab after one, two or three
 * spaces, since a tab advances to the next multiple of four columns and any tab
 * inside the first four columns lands on column four.
 */
const CODE_INDENT_RE = /^(?: {4}| {0,3}\t)/;

/**
 * Replace every placeholder line in the resume body with its expanded markdown.
 *
 * Line-based on purpose: a placeholder is a whole line, and matching per line
 * keeps surrounding offsets intact without string-replacing repeating content.
 * An unknown placeholder-shaped comment throws, so a typo cannot silently
 * render an empty section.
 *
 * The lines this skips are the ones remark would not treat as an HTML block
 * either, so the string form and the rendered form select the same placeholders:
 * a comment inside a fenced or indented code block is sample text in both, and
 * only 0–3 leading spaces still leave an HTML block at the top level. A comment
 * spanning several lines is one HTML block to both, so this scanner consumes it
 * whole rather than reading the markdown inside it.
 */
export function expandResumePlaceholders(body, data) {
  const lines = body.split("\n");
  const out = [];
  /** The open fence's character and length while inside a fenced block. */
  let fence = null;
  /** True while inside a multiline HTML comment block. */
  let comment = false;
  for (const line of lines) {
    if (comment) {
      // The block ends on the first line carrying the closing delimiter; an
      // unclosed comment runs to the end of the body, which is how remark reads
      // it too.
      if (line.includes(COMMENT_CLOSE)) comment = false;
      out.push(line);
      continue;
    }
    const fenceMatch = FENCE_RE.exec(line);
    if (fence) {
      // A closing fence repeats the opening character at least as many times
      // and carries nothing else. An unclosed block simply runs to the end of
      // the body, which is how remark reads it too.
      const closes =
        fenceMatch &&
        fenceMatch[1][0] === fence.char &&
        fenceMatch[1].length >= fence.length &&
        line.slice(fenceMatch[0].length).trim() === "";
      if (closes) fence = null;
      out.push(line);
      continue;
    }
    if (fenceMatch) {
      fence = { char: fenceMatch[1][0], length: fenceMatch[1].length };
      out.push(line);
      continue;
    }
    if (CODE_INDENT_RE.test(line)) {
      out.push(line);
      continue;
    }
    // Checked after the indent test on purpose: four columns of indentation make
    // `<!--` indented code rather than an HTML block, and remark agrees.
    if (COMMENT_OPEN_RE.test(line) && !line.includes(COMMENT_CLOSE)) {
      comment = true;
      out.push(line);
      continue;
    }
    const name = classifyPlaceholder(line);
    if (name) {
      const expanded = renderResumeSection(name, data);
      if (expanded) out.push(...expanded.split("\n"));
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}
