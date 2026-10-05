import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	RESUME_SECTIONS,
	formatMonthYear,
	renderCurrentRole,
	renderEducation,
	renderResumeSection,
	resumeMetaDescription,
	expandResumePlaceholders,
} from '../../src/lib/resume-sections.mjs';

const currentRole = {
	title: 'Senior IT Systems Engineering Manager, Digital Experience',
	employer: 'Gilead Sciences',
	location: 'Raleigh, NC',
	start_date: '2022-06-01',
};

const education = {
	items: [
		{
			degree: 'Master of Science, Information Technology',
			degree_abbr: 'M.S. I.T.',
			institution: 'Rochester Institute of Technology',
			location: 'Rochester, NY',
			years: '1998 – 2001',
			honors: 'With highest honors',
			render: true,
		},
		{
			degree: 'Bachelor of Fine Arts, Illustration',
			institution: 'University of the Arts',
			location: 'Philadelphia, PA',
			years: '1980 – 1984',
			render: false,
		},
	],
};

describe('formatMonthYear', () => {
	it('formats a YYYY-MM-DD string', () => {
		assert.equal(formatMonthYear('2022-06-01', 'x'), 'June 2022');
	});

	it('formats a YYYY-MM string', () => {
		assert.equal(formatMonthYear('2022-06', 'x'), 'June 2022');
	});

	it('reads a Date in UTC so a local timezone cannot shift the month', () => {
		// 2022-06-01T00:00:00Z is May 31 in every negative-offset timezone.
		assert.equal(formatMonthYear(new Date('2022-06-01T00:00:00.000Z'), 'x'), 'June 2022');
	});

	it('throws on a malformed string rather than printing a partial date', () => {
		assert.throws(() => formatMonthYear('June 2022', 'current_role.start_date'), /current_role\.start_date/);
	});

	it('throws on an out-of-range month', () => {
		assert.throws(() => formatMonthYear('2022-13', 'x'), /month out of range/);
	});

	it('throws on a non-date value', () => {
		assert.throws(() => formatMonthYear(undefined, 'x'), /expected a date string or Date/);
	});
});

describe('renderCurrentRole', () => {
	it('renders the heading and the employer line convention', () => {
		assert.equal(
			renderCurrentRole(currentRole),
			[
				'## Senior IT Systems Engineering Manager, Digital Experience',
				'',
				'**Gilead Sciences** — Raleigh, NC | June 2022 – Present',
			].join('\n')
		);
	});

	it('throws when current_role is absent', () => {
		assert.throws(() => renderCurrentRole(undefined), /`current_role` is missing/);
	});

	it('throws when location is absent, since the employer line needs it', () => {
		assert.throws(
			() => renderCurrentRole({ ...currentRole, location: undefined }),
			/location is required/
		);
	});

	it('throws when the title is blank', () => {
		assert.throws(() => renderCurrentRole({ ...currentRole, title: '  ' }), /title is required/);
	});
});

describe('renderEducation', () => {
	it('renders only items whose render flag is true', () => {
		const out = renderEducation(education);
		assert.match(out, /^## M\.S\. I\.T\./);
		assert.ok(!out.includes('University of the Arts'));
	});

	it('prefers degree_abbr over the formal degree name for the heading', () => {
		assert.ok(renderEducation(education).startsWith('## M.S. I.T.'));
	});

	it('falls back to degree when degree_abbr is absent', () => {
		const items = [{ ...education.items[1], render: true }];
		assert.ok(renderEducation({ items }).startsWith('## Bachelor of Fine Arts, Illustration'));
	});

	it('appends honors as its own paragraph', () => {
		assert.ok(renderEducation(education).endsWith('\n\nWith highest honors'));
	});

	it('expands to nothing when no item opts in — the schema default is an opt-out', () => {
		const items = education.items.map(item => ({ ...item, render: false }));
		assert.equal(renderEducation({ items }), '');
	});

	it('throws when education itself is missing', () => {
		assert.throws(() => renderEducation(undefined), /`education` is missing/);
	});
});

describe('resumeMetaDescription', () => {
	it('joins the role title and the career summary', () => {
		assert.equal(
			resumeMetaDescription({ current_role: currentRole, description: 'Platform operations.' }),
			'Senior IT Systems Engineering Manager, Digital Experience. Platform operations.'
		);
	});

	it('strips a trailing period from the title so the join never doubles it', () => {
		assert.equal(
			resumeMetaDescription({ current_role: { title: 'Manager.' }, description: 'Summary.' }),
			'Manager. Summary.'
		);
	});

	it('returns either part alone', () => {
		assert.equal(resumeMetaDescription({ current_role: currentRole }), currentRole.title);
		assert.equal(resumeMetaDescription({ description: 'Summary.' }), 'Summary.');
	});

	it('returns undefined when neither part exists', () => {
		assert.equal(resumeMetaDescription({}), undefined);
	});
});

describe('renderResumeSection', () => {
	it('dispatches every name in RESUME_SECTIONS', () => {
		for (const name of RESUME_SECTIONS) {
			assert.equal(
				typeof renderResumeSection(name, { current_role: currentRole, education }),
				'string'
			);
		}
	});

	it('throws on an unknown section name', () => {
		assert.throws(() => renderResumeSection('experience', {}), /unknown resume section/);
	});
});

describe('expandResumePlaceholders', () => {
	const data = { current_role: currentRole, education };

	it('replaces a placeholder line in place, leaving surrounding body text intact', () => {
		const body = ['<!-- current-role -->', '', 'Lead a team.', ''].join('\n');
		const out = expandResumePlaceholders(body, data);
		assert.equal(
			out,
			[
				'## Senior IT Systems Engineering Manager, Digital Experience',
				'',
				'**Gilead Sciences** — Raleigh, NC | June 2022 – Present',
				'',
				'Lead a team.',
				'',
			].join('\n')
		);
	});

	it('expands tolerating surrounding whitespace on the placeholder line', () => {
		assert.ok(expandResumePlaceholders('   <!-- education -->   ', data).startsWith('## M.S. I.T.'));
	});

	it('leaves facet comments and prose comments inert', () => {
		const body = 'Scope text. <!-- f: leadership, platform-ops -->\n\n<!-- TODO revisit -->';
		assert.equal(expandResumePlaceholders(body, data), body);
	});

	it('throws on a placeholder-shaped typo instead of rendering nothing', () => {
		assert.throws(
			() => expandResumePlaceholders('<!-- educaton -->', data),
			/unknown section placeholder "<!-- educaton -->"/
		);
	});

	it('drops the placeholder line when a section expands to empty', () => {
		const items = education.items.map(item => ({ ...item, render: false }));
		assert.equal(
			expandResumePlaceholders('before\n<!-- education -->\nafter', {
				...data,
				education: { items },
			}),
			'before\nafter'
		);
	});
});
