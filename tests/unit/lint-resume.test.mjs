import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	stripFacetTag,
	parseSections,
	checkMeasurableClaims,
	checkActiveVoice,
	checkBannedPhrases,
	checkPronouns,
} from '../../scripts/lint-resume.mjs';

describe('stripFacetTag', () => {
	it('removes a trailing facet comment', () => {
		assert.equal(
			stripFacetTag('Cut costs by 24% <!-- f: cost, platform-ops -->'),
			'Cut costs by 24%',
		);
	});

	it('is a no-op when there is no facet comment', () => {
		assert.equal(stripFacetTag('Cut costs by 24%'), 'Cut costs by 24%');
	});

	it('handles varied whitespace around the comment', () => {
		assert.equal(
			stripFacetTag('Led the team  <!-- f: leadership -->  '),
			'Led the team',
		);
	});
});

describe('parseSections', () => {
	const source = `
## Experience Role

**Employer Inc.** — City | 2020–2023

Scope description here.

- Delivered 50 widgets. <!-- f: delivery -->
- Reduced cost by 30%. <!-- f: cost -->

## Education Section

**Some University** — City | 2000–2004

With honors
`.trim();

	it('returns one section per H2 heading', () => {
		const sections = parseSections(source);
		assert.equal(sections.length, 2);
		assert.equal(sections[0].heading, 'Experience Role');
		assert.equal(sections[1].heading, 'Education Section');
	});

	it('extracts bullets stripped of "- " prefix and facet tag', () => {
		const { bullets } = parseSections(source)[0];
		assert.deepEqual(bullets, ['Delivered 50 widgets.', 'Reduced cost by 30%.']);
	});

	it('extracts scope prose without the employer line', () => {
		const { scopeText } = parseSections(source)[0];
		assert.equal(scopeText, 'Scope description here.');
	});

	it('returns empty bullets for an education-style section', () => {
		const { bullets } = parseSections(source)[1];
		assert.deepEqual(bullets, []);
	});

	it('captures scope text for a section with no bullets', () => {
		const noListSource = `## Supervisor\n\n**Shop** — City\n\nSupervised staff. <!-- f: leadership -->`;
		const [section] = parseSections(noListSource);
		assert.equal(section.bullets.length, 0);
		assert.equal(section.scopeText, 'Supervised staff.');
	});
});

describe('checkMeasurableClaims', () => {
	it('passes a bullet that contains a digit', () => {
		assert.deepEqual(checkMeasurableClaims(['Cut costs by 24%.'], 'Role'), []);
	});

	it('flags a bullet with no digit', () => {
		const result = checkMeasurableClaims(['Modernized delivery from months to hours.'], 'Role');
		assert.equal(result.length, 1);
		assert.equal(result[0].bullet, 'Modernized delivery from months to hours.');
		assert.equal(result[0].heading, 'Role');
	});

	it('passes a bullet where the only number is embedded in a word like "9-year"', () => {
		assert.deepEqual(checkMeasurableClaims(['Maintained zero turnover over a 9-year tenure.'], 'Role'), []);
	});
});

describe('checkActiveVoice', () => {
	it('passes a bullet that starts with a strong action verb', () => {
		assert.deepEqual(checkActiveVoice(['Led the platform migration.'], 'Role'), []);
	});

	it('flags a was + past-participle passive construction', () => {
		const result = checkActiveVoice(['Platform was managed by external vendors.'], 'Role');
		assert.equal(result.length, 1);
		assert.match(result[0].bullet, /was managed/);
	});

	it('flags were + past-participle passive construction', () => {
		const result = checkActiveVoice(['Systems were developed over two years.'], 'Role');
		assert.equal(result.length, 1);
	});

	it('does not flag "was" when not followed by a word ending in ed/en', () => {
		assert.deepEqual(checkActiveVoice(['Output was clean and reliable.'], 'Role'), []);
	});
});

describe('checkBannedPhrases', () => {
	it('flags "leverage"', () => {
		const result = checkBannedPhrases('We leverage cloud tools to deliver.', 'Role');
		assert.equal(result.length, 1);
		assert.equal(result[0].phrase, 'leverage');
	});

	it('flags "synergy"', () => {
		const result = checkBannedPhrases('Drove synergy across teams.', 'Role');
		assert.equal(result.length, 1);
		assert.equal(result[0].phrase, 'synergy');
	});

	it('flags "spearheaded"', () => {
		const result = checkBannedPhrases('Spearheaded a new initiative.', 'Role');
		assert.equal(result.length, 1);
		assert.equal(result[0].phrase, 'spearheaded');
	});

	it('passes clean text with no banned phrases', () => {
		assert.deepEqual(checkBannedPhrases('Cut deployment time by 40%.', 'Role'), []);
	});

	it('is case-insensitive', () => {
		const result = checkBannedPhrases('Used LEVERAGE to achieve goals.', 'Role');
		assert.equal(result.length, 1);
	});
});

describe('checkPronouns', () => {
	it('flags "we" at word boundary', () => {
		const result = checkPronouns('We delivered the project on time.', 'Role');
		assert.equal(result.length, 1);
	});

	it('flags lowercase "we"', () => {
		const result = checkPronouns('Led a team; we reduced costs by 20%.', 'Role');
		assert.equal(result.length, 1);
	});

	it('does not flag "we" embedded in a word like "new" or "anew"', () => {
		assert.deepEqual(checkPronouns('Introduced a new deployment workflow.', 'Role'), []);
		assert.deepEqual(checkPronouns('Rebuilt anew from scratch.', 'Role'), []);
	});

	it('returns empty array for clean text', () => {
		assert.deepEqual(checkPronouns('Cut costs by 30%.', 'Role'), []);
	});
});
