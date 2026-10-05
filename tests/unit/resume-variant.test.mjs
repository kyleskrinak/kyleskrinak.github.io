import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Script, createContext } from 'node:vm';
import { parseHTML } from 'linkedom';
import {
	validateIncludeCertsShape,
	validateIncludeSkillsShape,
	includeSkillsRequestsSkills,
	validateConfig,
	validateBulletOrderRange,
	validateCertificationsData,
	resolveCerts,
	resolveSkills,
	injectCerts,
	certDateSuffix,
	injectSkills,
	parseResumePreviewPort,
	buildTransform,
} from '../../scripts/build-resume-variant.mjs';

const knownCertIds = new Set(['aiops-foundation', 'az-104']);
const knownSkillIds = new Set(['leadership', 'platform-ops']);

// Two categories are enough to prove order and rendering; the real inventory
// lives in the resume frontmatter.
const skillCategories = [
	{
		id: 'leadership',
		name: 'Leadership & Team Development',
		skills: ['Technical Leadership', 'Team Management'],
	},
	{
		id: 'platform-ops',
		name: 'Platform Operations',
		skills: ['Site Reliability', 'Incident Management'],
	},
];
const knownEntryIds = new Set([
	'ms-it',
	'senior-it-systems-engineering-manager-digital-experience',
]);

const certData = {
	anchor_before_id: 'ms-it',
	certifications: [
		{
			id: 'aiops-foundation',
			name: 'AIOps Foundation',
			issuer: 'PeopleCert',
			issued: '2026-01',
		},
		{
			id: 'az-104',
			name: 'Microsoft Certified: Azure Administrator Associate (AZ-104)',
			issuer: 'Microsoft',
		},
	],
};

async function runSerializedTransform(config) {
	const { document, window } = parseHTML(`
		<html>
			<head></head>
			<body>
				<article class="resume-content">
					<h2 id="entry-one">Entry One</h2>
					<p><strong>Employer</strong> — Location | Dates</p>
					<ul>
						<li data-facets="leadership">First bullet</li>
						<li data-facets="platform-ops">Second bullet</li>
					</ul>
				</article>
			</body>
		</html>
	`);
	const page = {
		async evaluate(fn, payload) {
			return new Script(`(${fn.toString()})(payload)`).runInContext(
				createContext({ document, window, payload, console }),
			);
		},
	};

	await buildTransform(config)(page);
	return document;
}

describe('validateIncludeCertsShape', () => {
	it('accepts omitted, empty, and "all" include_certs values', () => {
		assert.deepEqual(validateIncludeCertsShape(undefined), []);
		assert.deepEqual(validateIncludeCertsShape([]), []);
		assert.deepEqual(validateIncludeCertsShape('all'), []);
	});

	it('rejects malformed values before any cert file dependency', () => {
		assert.match(validateIncludeCertsShape(123).join('\n'), /array of cert ids or "all"/);
		assert.match(validateIncludeCertsShape({ id: 'az-104' }).join('\n'), /array of cert ids or "all"/);
		assert.match(validateIncludeCertsShape(['az-104', 123]).join('\n'), /non-empty strings/);
		assert.match(validateIncludeCertsShape(['az-104', '']).join('\n'), /non-empty strings/);
	});

	it('rejects duplicate cert ids', () => {
		assert.match(
			validateIncludeCertsShape(['az-104', 'aiops-foundation', 'az-104']).join('\n'),
			/duplicate id\(s\): az-104/,
		);
	});
});

describe('validateConfig', () => {
	it('accepts known include_certs ids and anchor_before_id override', () => {
		assert.doesNotThrow(() => {
			validateConfig(
				{
					include_certs: ['az-104'],
					anchor_before_id: 'senior-it-systems-engineering-manager-digital-experience',
				},
				'variant.json',
				knownCertIds,
			);
		});
	});

	it('rejects unknown cert ids when knownCertIds is provided', () => {
		assert.throws(
			() => validateConfig({ include_certs: ['missing-cert'] }, 'variant.json', knownCertIds),
			/unknown cert id\(s\): missing-cert/,
		);
	});

	it('rejects unknown anchor_before_id overrides', () => {
		assert.throws(
			() => validateConfig({ anchor_before_id: 'missing-entry' }, 'variant.json', knownCertIds),
			/anchor_before_id: unknown entry key "missing-entry"/,
		);
	});

	it('rejects empty and whitespace-only title overrides', () => {
		assert.throws(
			() => validateConfig({ title: '' }, 'variant.json', knownCertIds),
			/title: must be a non-empty string/,
		);
		assert.throws(
			() => validateConfig({ title: '   ' }, 'variant.json', knownCertIds),
			/title: must be a non-empty string/,
		);
	});

	it('accepts title overrides with surrounding whitespace so rendering can trim them', () => {
		assert.doesNotThrow(() => validateConfig({ title: '  Platform Leader  ' }, 'variant.json', knownCertIds));
	});
});

describe('validateBulletOrderRange', () => {
	it('rejects out-of-range indices after facet filtering determines kept bullet count', () => {
		assert.throws(
			() => validateBulletOrderRange('senior-it-systems-engineering-manager-digital-experience', [0, 2], 2),
			/bullet_order\.senior-it-systems-engineering-manager-digital-experience: index 2 out of range for 2 kept bullet\(s\) after filtering/,
		);
	});
});

describe('buildTransform bullet_order', () => {
	it('applies non-empty bullet_order inside the serialized page context', async () => {
		const document = await runSerializedTransform({
			bullet_order: { 'entry-one': [1, 0] },
		});

		assert.deepEqual(
			Array.from(document.querySelectorAll('.resume-content li')).map(li => li.textContent),
			['Second bullet', 'First bullet'],
		);
	});

	it('rejects out-of-range bullet_order inside the serialized page context', async () => {
		await assert.rejects(
			() => runSerializedTransform({ bullet_order: { 'entry-one': [2] } }),
			/bullet_order\.entry-one: index 2 out of range for 2 kept bullet\(s\) after filtering/,
		);
	});
});

describe('validateCertificationsData', () => {
	it('accepts valid certification data', () => {
		assert.equal(validateCertificationsData(certData, 'certifications.json', knownEntryIds), certData);
	});

	it('rejects malformed certification data', () => {
		assert.throws(
			() => validateCertificationsData({ ...certData, certifications: [] }, 'certifications.json', knownEntryIds),
			/certifications: must be a non-empty array/,
		);
		assert.throws(
			() =>
				validateCertificationsData(
					{ ...certData, anchor_before_id: 'missing-entry' },
					'certifications.json',
					knownEntryIds,
				),
			/anchor_before_id: unknown entry key "missing-entry"/,
		);
		assert.throws(
			() =>
				validateCertificationsData(
					{
						...certData,
						certifications: [
							{ id: 'az-104', name: 'Azure Administrator' },
							{ id: 'az-104', name: 'Duplicate Azure Administrator' },
						],
					},
					'certifications.json',
					knownEntryIds,
				),
			/duplicate id\(s\): az-104/,
		);
		assert.throws(
			() =>
				validateCertificationsData(
					{
						...certData,
						certifications: [{ id: 'az-104', name: 'Azure Administrator', issued: '2026-13' }],
					},
					'certifications.json',
					knownEntryIds,
				),
			/issued: must match YYYY-MM/,
		);
		assert.throws(
			() =>
				validateCertificationsData(
					{
						...certData,
						certifications: [{ id: 'az-104', name: 'Azure Administrator', expires: '2029-00' }],
					},
					'certifications.json',
					knownEntryIds,
				),
			/expires: must match YYYY-MM/,
		);
		assert.throws(
			() =>
				validateCertificationsData(
					{
						...certData,
						certifications: [
							{ id: 'az-104', name: 'Azure Administrator', issued: '2026-01', expires: '2025-06' },
						],
					},
					'certifications.json',
					knownEntryIds,
				),
			/expires: must be after issued \(2026-01\), got 2025-06/,
		);
		// Equal months are a data error, not a zero-length validity window.
		assert.throws(
			() =>
				validateCertificationsData(
					{
						...certData,
						certifications: [
							{ id: 'az-104', name: 'Azure Administrator', issued: '2026-01', expires: '2026-01' },
						],
					},
					'certifications.json',
					knownEntryIds,
				),
			/expires: must be after issued/,
		);
		assert.throws(
			() =>
				validateCertificationsData(
					{
						...certData,
						certifications: [{ id: 'az-104', name: 'Azure Administrator', issuer: '' }],
					},
					'certifications.json',
					knownEntryIds,
				),
			/issuer: must be a non-empty string/,
		);
		assert.throws(
			() =>
				validateCertificationsData(
					{
						...certData,
						certifications: [{ id: 'az-104', name: 'Azure Administrator', facets: ['platform-ops'] }],
					},
					'certifications.json',
					knownEntryIds,
				),
			/facets: not supported/,
		);
	});
});

describe('resolveCerts', () => {
	it('resolves explicit cert ids in requested order', () => {
		assert.deepEqual(
			resolveCerts(['az-104', 'aiops-foundation'], certData).map(cert => cert.id),
			['az-104', 'aiops-foundation'],
		);
	});

	it('resolves "all" in file order', () => {
		assert.deepEqual(
			resolveCerts('all', certData).map(cert => cert.id),
			['aiops-foundation', 'az-104'],
		);
	});

	it('returns no certs when omitted or empty', () => {
		assert.deepEqual(resolveCerts(undefined, certData), []);
		assert.deepEqual(resolveCerts([], certData), []);
	});

	it('rejects unknown cert ids', () => {
		assert.throws(
			() => resolveCerts(['missing-cert'], certData),
			/include_certs: unknown cert id "missing-cert"/,
		);
	});
});

describe('certDateSuffix', () => {
	it('renders a range when both dates are present', () => {
		assert.equal(certDateSuffix({ issued: '2026-01', expires: '2029-01' }), ' (2026-01 – 2029-01)');
	});

	it('leaves the issued-only form byte-identical to the pre-expiry output', () => {
		assert.equal(certDateSuffix({ issued: '2026-01' }), ' (2026-01)');
	});

	it('labels a lone expiry so it cannot read as an issue month', () => {
		assert.equal(certDateSuffix({ expires: '2029-01' }), ' (expires 2029-01)');
	});

	it('returns an empty string for a credential with no dates', () => {
		assert.equal(certDateSuffix({ id: 'az-104', name: 'Azure Administrator' }), '');
	});
});

describe('injectCerts', () => {
	it('renders an expiry range in the injected list item', () => {
		const { document } = parseHTML(`
			<html>
				<head></head>
				<body>
					<article class="resume-content">
						<h2 id="ms-it">M.S. I.T.</h2>
					</article>
				</body>
			</html>
		`);
		const content = document.querySelector('.resume-content');

		injectCerts(
			content,
			[
				{
					id: 'aiops-foundation',
					name: 'AIOps Foundation',
					issuer: 'PeopleCert',
					issued: '2026-01',
					expires: '2029-01',
				},
			],
			'ms-it',
		);

		assert.equal(
			content.querySelector('h2.cert-heading').nextElementSibling.querySelector('li').textContent,
			'AIOps Foundation — PeopleCert (2026-01 – 2029-01)',
		);
	});

	it('injects the cert heading and list before the scoped anchor', () => {
		const { document } = parseHTML(`
			<html>
				<head></head>
				<body>
					<article class="resume-content">
						<h2 id="senior-it-systems-engineering-manager-digital-experience">Senior IT Systems Engineering Manager</h2>
						<ul><li>Existing bullet</li></ul>
						<h2 id="ms-it">M.S. I.T.</h2>
					</article>
				</body>
			</html>
		`);
		const content = document.querySelector('.resume-content');

		injectCerts(content, certData.certifications, 'ms-it');

		const heading = content.querySelector('h2.cert-heading');
		assert.equal(heading.textContent, 'Certifications');
		assert.equal(heading.nextElementSibling.tagName, 'UL');
		assert.equal(heading.nextElementSibling.nextElementSibling.id, 'ms-it');
		assert.deepEqual(
			Array.from(heading.nextElementSibling.querySelectorAll('li')).map(li => li.textContent),
			[
				'AIOps Foundation — PeopleCert (2026-01)',
				'Microsoft Certified: Azure Administrator Associate (AZ-104) — Microsoft',
			],
		);
		assert.match(
			document.getElementById('resume-variant-cert-heading-style').textContent,
			/h2\.cert-heading::after/,
		);
	});

	it('uses the resume-content-scoped anchor, not a same-id element elsewhere', () => {
		const { document } = parseHTML(`
			<html>
				<head></head>
				<body>
					<h2 id="ms-it">Outside resume</h2>
					<article class="resume-content">
						<h2 id="other">Other</h2>
					</article>
				</body>
			</html>
		`);

		assert.throws(
			() => injectCerts(document.querySelector('.resume-content'), certData.certifications, 'ms-it'),
			/Certification anchor not found: ms-it/,
		);
	});
});

describe('validateIncludeSkillsShape', () => {
	it('accepts omitted and "all" include_skills values', () => {
		assert.deepEqual(validateIncludeSkillsShape(undefined), []);
		assert.deepEqual(validateIncludeSkillsShape('all'), []);
		assert.deepEqual(validateIncludeSkillsShape(['leadership']), []);
	});

	it('rejects a non-array, non-"all" value', () => {
		assert.deepEqual(validateIncludeSkillsShape('leadership'), [
			'include_skills: must be an array of skill category ids or "all"',
		]);
	});

	it('rejects empty strings and duplicates', () => {
		assert.deepEqual(validateIncludeSkillsShape(['  ']), [
			'include_skills: must contain only non-empty strings',
		]);
		assert.deepEqual(validateIncludeSkillsShape(['leadership', 'leadership']), [
			'include_skills: duplicate id(s): leadership',
		]);
	});
});

describe('includeSkillsRequestsSkills', () => {
	it('distinguishes a request for skills from an opt-out', () => {
		assert.equal(includeSkillsRequestsSkills('all'), true);
		assert.equal(includeSkillsRequestsSkills(['leadership']), true);
		assert.equal(includeSkillsRequestsSkills([]), false);
		assert.equal(includeSkillsRequestsSkills(undefined), false);
	});
});

describe('validateConfig include_skills', () => {
	it('accepts known skill ids with a skills anchor', () => {
		assert.doesNotThrow(() => {
			validateConfig(
				{ include_skills: ['leadership'], skills_anchor_before_id: 'ms-it' },
				'variant.json',
				knownCertIds,
				knownSkillIds,
			);
		});
	});

	it('rejects unknown skill category ids', () => {
		assert.throws(
			() =>
				validateConfig(
					{ include_skills: ['missing-skill'], skills_anchor_before_id: 'ms-it' },
					'variant.json',
					knownCertIds,
					knownSkillIds,
				),
			/include_skills: unknown skill category id\(s\): missing-skill/,
		);
	});

	it('requires an anchor when skills are requested', () => {
		assert.throws(
			() => validateConfig({ include_skills: 'all' }, 'variant.json', knownCertIds, knownSkillIds),
			/include_skills: requires skills_anchor_before_id/,
		);
	});

	it('lets a skills request inherit the cert anchor', () => {
		assert.doesNotThrow(() => {
			validateConfig(
				{ include_skills: 'all', anchor_before_id: 'ms-it' },
				'variant.json',
				knownCertIds,
				knownSkillIds,
			);
		});
	});

	it('rejects an unknown skills_anchor_before_id', () => {
		assert.throws(
			() =>
				validateConfig(
					{ include_skills: 'all', skills_anchor_before_id: 'missing-entry' },
					'variant.json',
					knownCertIds,
					knownSkillIds,
				),
			/skills_anchor_before_id: unknown entry key "missing-entry"/,
		);
	});
});

describe('resolveSkills', () => {
	it('keeps source order for "all"', () => {
		assert.deepEqual(
			resolveSkills('all', skillCategories).map(c => c.id),
			['leadership', 'platform-ops'],
		);
	});

	it('keeps config order for an explicit list', () => {
		assert.deepEqual(
			resolveSkills(['platform-ops', 'leadership'], skillCategories).map(c => c.id),
			['platform-ops', 'leadership'],
		);
	});

	it('returns nothing when skills are not requested', () => {
		assert.deepEqual(resolveSkills([], skillCategories), []);
		assert.deepEqual(resolveSkills(undefined, skillCategories), []);
	});

	it('throws on an unknown id', () => {
		assert.throws(
			() => resolveSkills(['missing'], skillCategories),
			/include_skills: unknown skill category id "missing"/,
		);
	});
});

describe('injectSkills', () => {
	function fixture() {
		const { document } = parseHTML(`
			<html>
				<head></head>
				<body>
					<article class="resume-content">
						<h2 id="ms-it">M.S. I.T.</h2>
					</article>
				</body>
			</html>
		`);
		return document;
	}

	it('inserts a Skills heading and one list item per category before the anchor', () => {
		const document = fixture();
		injectSkills(document.querySelector('.resume-content'), skillCategories, 'ms-it');

		const headings = Array.from(document.querySelectorAll('.resume-content h2')).map(h => h.textContent);
		assert.deepEqual(headings, ['Skills', 'M.S. I.T.']);

		const items = Array.from(document.querySelectorAll('.resume-content ul li')).map(li => li.textContent);
		assert.deepEqual(items, [
			'Leadership & Team Development: Technical Leadership, Team Management',
			'Platform Operations: Site Reliability, Incident Management',
		]);
	});

	it('adds the print exemption the injected heading needs exactly once', () => {
		const document = fixture();
		const content = document.querySelector('.resume-content');
		injectSkills(content, skillCategories, 'ms-it');
		injectSkills(content, skillCategories, 'ms-it');
		assert.equal(document.querySelectorAll('#resume-variant-skills-heading-style').length, 1);
	});

	it('returns null without touching the document when no categories are selected', () => {
		const document = fixture();
		const content = document.querySelector('.resume-content');
		assert.equal(injectSkills(content, [], 'ms-it'), null);
		assert.equal(content.querySelector('h2.skills-heading'), null);
	});

	it('throws when the anchor is missing from the resume content', () => {
		const { document } = parseHTML(`
			<html>
				<head></head>
				<body>
					<h2 id="ms-it">Outside resume</h2>
					<article class="resume-content"><h2 id="other">Other</h2></article>
				</body>
			</html>
		`);
		assert.throws(
			() => injectSkills(document.querySelector('.resume-content'), skillCategories, 'ms-it'),
			/Skills anchor not found: ms-it/,
		);
	});

	it('throws when no anchor id is supplied', () => {
		const document = fixture();
		assert.throws(
			() => injectSkills(document.querySelector('.resume-content'), skillCategories, ''),
			/skills_anchor_before_id is required/,
		);
	});
});

describe('parseResumePreviewPort', () => {
	it('parses default and explicit valid ports without process exit side effects', () => {
		assert.equal(parseResumePreviewPort({}), 4323);
		assert.equal(parseResumePreviewPort({ RESUME_PREVIEW_PORT: '5555' }), 5555);
	});

	it('rejects invalid ports with an exception', () => {
		assert.throws(
			() => parseResumePreviewPort({ RESUME_PREVIEW_PORT: 'abc' }),
			/Invalid RESUME_PREVIEW_PORT/,
		);
	});
});
