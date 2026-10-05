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
 * Dates: frontmatter reaches us as a Date through Astro's `z.coerce.date()`
 * and as a plain "YYYY-MM-DD" string through the scripts' YAML parse. Both
 * are accepted; a Date is read in UTC so a local timezone can never shift the
 * rendered month.
 */

/** Placeholder names this module knows how to expand. */
export const RESUME_SECTIONS = ["current-role", "education"];

/**
 * A placeholder occupies a whole line: `<!-- education -->`. Anchored and
 * name-restricted so an unrelated HTML comment in the body stays inert.
 */
export const PLACEHOLDER_RE = new RegExp(
  `^<!--\\s*(${RESUME_SECTIONS.join("|")})\\s*-->$`,
);

/**
 * Catches a placeholder-shaped comment whose name is NOT in RESUME_SECTIONS,
 * so a typo (`<!-- educaton -->`) fails the build instead of rendering nothing.
 * Deliberately narrow: only single-word, hyphenated lowercase comment bodies
 * look like a placeholder; prose comments and facet tags never match.
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
 * "2022-06-01" | Date → "June 2022". Throws rather than returning a partial
 * date: a silently wrong month on the resume is worse than a failed build.
 */
export function formatMonthYear(value, label) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) fail(`${label}: invalid Date`);
    return `${MONTHS[value.getUTCMonth()]} ${value.getUTCFullYear()}`;
  }
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})(?:-\d{2})?/.exec(value.trim());
    if (!m) fail(`${label}: expected YYYY-MM or YYYY-MM-DD, got "${value}"`);
    const month = Number(m[2]);
    if (month < 1 || month > 12) fail(`${label}: month out of range in "${value}"`);
    return `${MONTHS[month - 1]} ${m[1]}`;
  }
  return fail(`${label}: expected a date string or Date, got ${typeof value}`);
}

/**
 * The employer line convention every resume section follows:
 *   **Employer** — Location | Dates
 *
 * Both tail fields are required: resume-render.mjs matches employers on the
 * em dash and lint-resume.mjs identifies the line by its pipe and its digits,
 * so a line missing either would silently stop being recognized as one.
 */
function employerLine(employer, location, dates, label) {
  if (!employer?.trim()) fail(`${label}: employer is required`);
  if (!location?.trim()) fail(`${label}: location is required to build the employer line`);
  if (!dates?.trim()) fail(`${label}: dates are required to build the employer line`);
  return `**${employer.trim()}** ${EMPLOYER_DASH} ${location.trim()} | ${dates.trim()}`;
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
 * One section per education item whose `render` flag is true. The schema
 * defaults `render` to false, so an item is opt-in: a zero-item expansion is
 * the author's explicit choice and expands to nothing rather than throwing.
 * A missing `education` object, by contrast, means the placeholder points at
 * data that does not exist — that throws.
 */
export function renderEducation(education) {
  if (!education) fail("<!-- education --> is present but `education` is missing from the frontmatter");
  const items = education.items ?? [];
  if (!Array.isArray(items)) fail("education.items must be an array");
  return items
    .map((item, idx) => [item, idx])
    .filter(([item]) => item?.render === true)
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

/**
 * Replace every placeholder line in the resume body with its expanded markdown.
 *
 * Line-based on purpose: a placeholder is a whole line, and matching per line
 * keeps surrounding offsets intact without string-replacing repeating content.
 * An unknown placeholder-shaped comment throws, so a typo cannot silently
 * render an empty section.
 */
export function expandResumePlaceholders(body, data) {
  const lines = body.split("\n");
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const match = PLACEHOLDER_RE.exec(trimmed);
    if (match) {
      const expanded = renderResumeSection(match[1], data);
      if (expanded) out.push(...expanded.split("\n"));
      continue;
    }
    const shaped = PLACEHOLDER_SHAPED_RE.exec(trimmed);
    if (shaped && !RESUME_SECTIONS.includes(shaped[1])) {
      fail(
        `unknown section placeholder "<!-- ${shaped[1]} -->" — known sections: ${RESUME_SECTIONS.join(", ")}`,
      );
    }
    out.push(line);
  }
  return out.join("\n");
}
