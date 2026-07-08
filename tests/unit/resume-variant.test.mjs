import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Script, createContext } from 'node:vm';
import { parseHTML } from 'linkedom';
import {
	validateIncludeCertsShape,
	validateConfig,
	validateBulletOrderRange,
	validateCertificationsData,
	resolveCerts,
	injectCerts,
	parseResumePreviewPort,
	buildTransform,
} from '../../scripts/build-resume-variant.mjs';

const knownCertIds = new Set(['aiops-foundation', 'az-104']);
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

describe('injectCerts', () => {
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
