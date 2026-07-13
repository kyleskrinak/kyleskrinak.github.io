#!/usr/bin/env node
/**
 * Content-quality guard for the resume source file.
 *
 * Checks four Manager Tools rubric items:
 *   1. Measurable claims  — every bullet must contain at least one digit
 *   2. Active voice       — flags was/were + regular -ed constructions
 *   3. Banned phrases     — resume jargon blocklist (leverage, synergy, …)
 *   4. Pronouns           — collective "we" hides individual contribution
 *
 * Checks 1–2 apply to bullet lines only.
 * Checks 3–4 apply to bullet lines AND scope prose paragraphs.
 *
 * Exit 1 and print violations to stderr if any check fails.
 * Exit 0 and print a summary line on success.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RESUME_SOURCE = join(ROOT, 'src/content/pages/resume/index.md');

// Matches a trailing <!-- f: ... --> facet comment (the remark-facets format).
const FACET_TAG_RE = /\s*<!--\s*f:[\s\S]*?-->\s*$/;

// Employer line: bold name followed by em-dash, location pipe, and year digits.
const EMPLOYER_LINE_RE = /^\*\*.+\*\*\s+—.*\|.*\d/;

// Bullet line
const BULLET_RE = /^- /;

const BANNED_PHRASES = [
	'leverage',
	'leveraged',
	'leveraging',
	'utilize',
	'utilized',
	'utilizing',
	'synergy',
	'synergistic',
	'spearheaded',
	'impactful',
	'value-add',
	'best-in-class',
	'world-class',
	'cutting-edge',
	'cutting edge',
	'paradigm',
	'game-changer',
	'thought leader',
	'proactive',
	'proactively',
	'innovative',
	'best practice',
];

// Pre-build regex for each phrase. The leading \b anchors at a word boundary;
// no trailing \b so suffixed/pluralized forms (value-added, thought leaders) are caught.
// All regex metacharacters are escaped before the hyphen-to-class substitution.
const BANNED_RES = BANNED_PHRASES.map(p => ({
	phrase: p,
	re: new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '[-]')}`, 'i'),
}));

export function stripFacetTag(text) {
	return text.replace(FACET_TAG_RE, '').trimEnd();
}

/**
 * Parse the resume markdown body (frontmatter already stripped) into sections.
 * Returns an array of { heading, scopeText, bullets } for every H2 section.
 * scopeText is the joined scope prose (employer line excluded).
 * bullets is an array of cleaned bullet strings (leading "- " and facet tag removed).
 */
export function parseSections(source) {
	const lines = source.split('\n');
	const sections = [];
	let current = null;

	for (const raw of lines) {
		const line = raw.trimEnd();

		if (line.startsWith('## ')) {
			if (current) sections.push(finalize(current));
			current = { heading: line.slice(3).trim(), proseLines: [], bullets: [] };
			continue;
		}

		if (!current) continue;

		if (BULLET_RE.test(line)) {
			current.bullets.push(stripFacetTag(line.slice(2).trim()));
			continue;
		}

		if (EMPLOYER_LINE_RE.test(line)) continue; // skip employer/date line

		const text = stripFacetTag(line).trim();
		if (text) current.proseLines.push(text);
	}

	if (current) sections.push(finalize(current));
	return sections;
}

function finalize({ heading, proseLines, bullets }) {
	return { heading, scopeText: proseLines.join(' '), bullets };
}

/**
 * Flag bullets that contain no digit (no measurable quantity).
 * Returns Array<{ bullet, heading }>.
 */
export function checkMeasurableClaims(bullets, heading) {
	return bullets
		.filter(b => !/\d/.test(b))
		.map(bullet => ({ bullet, heading }));
}

/**
 * Flag bullets matching a was/were + past-participle passive pattern.
 * Returns Array<{ bullet, heading }>.
 */
export function checkActiveVoice(bullets, heading) {
	// Match was/were + past-participle -ed only; -en forms (open, golden, broken) cause
	// false positives on common adjectives and are excluded from this check.
	const PASSIVE_RE = /\b(was|were)\s+[a-z]+ed\b/i;
	return bullets
		.filter(b => PASSIVE_RE.test(b))
		.map(bullet => ({ bullet, heading }));
}

/**
 * Flag text (bullet or scope prose) containing a banned phrase.
 * Returns Array<{ phrase, text, heading }>.
 */
export function checkBannedPhrases(text, heading) {
	const violations = [];
	for (const { phrase, re } of BANNED_RES) {
		if (re.test(text)) violations.push({ phrase, text, heading });
	}
	return violations;
}

/**
 * Flag text containing the collective pronoun "we".
 * Returns Array<{ text, heading }>.
 */
export function checkPronouns(text, heading) {
	return /\bwe\b/i.test(text) ? [{ text, heading }] : [];
}

function main() {
	const raw = readFileSync(RESUME_SOURCE, 'utf8').replace(/\r\n/g, '\n');
	const body = raw.replace(/^---\n[\s\S]*?\n---/, '');
	const sections = parseSections(body);

	if (sections.length === 0) {
		process.stderr.write(`lint-resume: no ## sections found in ${RESUME_SOURCE} — wrong file or empty resume.\n`);
		process.exit(1);
	}

	const violations = [];

	for (const { heading, scopeText, bullets } of sections) {
		// Measurable claims and active voice — bullets only.
		for (const v of checkMeasurableClaims(bullets, heading)) {
			violations.push(`[measurable-claims] ${v.heading}: "${v.bullet}"`);
		}
		for (const v of checkActiveVoice(bullets, heading)) {
			violations.push(`[active-voice] ${v.heading}: "${v.bullet}"`);
		}

		// Banned phrases and pronouns — bullets AND scope prose.
		for (const b of bullets) {
			for (const v of checkBannedPhrases(b, heading)) {
				violations.push(`[banned-phrases] ${v.heading}: "${v.phrase}" in "${v.text}"`);
			}
			for (const v of checkPronouns(b, heading)) {
				violations.push(`[pronouns] ${v.heading}: "${v.text}"`);
			}
		}
		if (scopeText) {
			for (const v of checkBannedPhrases(scopeText, heading)) {
				violations.push(`[banned-phrases] ${v.heading}: "${v.phrase}" in scope prose`);
			}
			for (const v of checkPronouns(scopeText, heading)) {
				violations.push(`[pronouns] ${v.heading}: scope prose contains "we"`);
			}
		}
	}

	if (violations.length > 0) {
		for (const v of violations) process.stderr.write(`  ✖  ${v}\n`);
		process.stderr.write(`lint-resume: ${violations.length} violation(s) — fix before build.\n`);
		process.exit(1);
	}

	process.stdout.write(`lint-resume: ${sections.length} section(s) checked, 0 violation(s).\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
