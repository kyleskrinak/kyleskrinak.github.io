import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Script, createContext } from 'node:vm';
import { parseHTML } from 'linkedom';
import {
	validateConfig,
	parseResumePreviewPort,
	buildTransform,
} from '../../scripts/build-resume-variant.mjs';

const knownEntryIds = new Set([
	'senior-manager-it',
	'senior-it-systems-engineering-manager-digital-experience',
]);

// Passed to every validateConfig call so no test derives entry ids from the live
// resume: a heading edit there must not be able to fail these assertions.
const vocabularies = {
	entryIds: knownEntryIds,
};

const SERIALIZED_FIXTURE = `
	<html>
		<head></head>
		<body>
			<article class="resume-content">
				<h2 id="entry-one"><strong>Dates</strong>: <strong>Entry One</strong>, <strong>Employer</strong> — Location</h2>
				<p>Scope paragraph.</p>
				<ul>
					<li data-facets="leadership">First bullet</li>
					<li data-facets="platform-ops">Second bullet</li>
				</ul>
				<h2 id="entry-two"><strong>Dates</strong>: <strong>Entry Two</strong>, <strong>Employer</strong> — Location</h2>
				<ul>
					<li>Third bullet</li>
				</ul>
				<h2 id="degree-school">Degree, School — Location | Years</h2>
			</article>
		</body>
	</html>
`;

// The page object the transform talks to. evaluate runs the function from its
// source text inside a vm context, the way page.evaluate sends it to Chromium: a
// module-scope helper the in-page body referenced would be a free identifier
// here exactly as it is in the browser, so it throws a ReferenceError in this
// harness instead of only in a real render.
function createSerializedPage(html = SERIALIZED_FIXTURE) {
	const { document, window } = parseHTML(html);
	const context = createContext({ document, window, console });
	return {
		document,
		page: {
			async evaluate(fn, payload) {
				context.payload = payload;
				return new Script(`(${fn.toString()})(payload)`).runInContext(context);
			},
		},
	};
}

async function runSerializedTransform(config) {
	const { document, page } = createSerializedPage();
	await buildTransform(config)(page);
	return document;
}

// Every bullet left on the page, in document order.
function bulletTexts(document) {
	return Array.from(document.querySelectorAll('.resume-content li')).map(li => li.textContent);
}

describe('validateConfig', () => {
	// Manager Tools puts no headline on a resume, so the key that once swapped
	// the name line for one must fail as unknown rather than be ignored.
	it('rejects the retired title key as unknown', () => {
		assert.throws(
			() => validateConfig({ title: 'Platform Leader' }, 'variant.json', vocabularies),
			/unknown config key\(s\): title/,
		);
	});

	// Manager Tools puts no skills list and no certifications on a resume, so the
	// keys a variant once used for them must fail as unknown rather than be ignored.
	it('rejects the retired skills and certification keys as unknown', () => {
		assert.throws(
			() =>
				validateConfig(
					{
						include_skills: 'all',
						skills_anchor_before_id: 'ms-it',
						include_certs: 'all',
						anchor_before_id: 'ms-it',
					},
					'variant.json',
					vocabularies,
				),
			/unknown config key\(s\): include_skills, skills_anchor_before_id, include_certs, anchor_before_id/,
		);
	});

	// Manager Tools sets no bullet count, per entry or overall: bullet_order
	// chooses which bullets a variant keeps, so the old cap must fail as unknown.
	it('rejects the retired max_bullets_per_entry key as unknown', () => {
		assert.throws(
			() => validateConfig({ max_bullets_per_entry: 2 }, 'variant.json', vocabularies),
			/unknown config key\(s\): max_bullets_per_entry/,
		);
	});

	// One ranked queue for the whole page replaced the per-entry lists, so an old
	// config fails loudly instead of building something nobody chose.
	it('rejects the retired per-entry bullet_order object', () => {
		assert.throws(
			() => validateConfig({ bullet_order: { 'senior-manager-it': [0] } }, 'variant.json', vocabularies),
			/bullet_order: must be an array/,
		);
	});

	it('accepts a page-wide queue of "<entry id>/<n>" items', () => {
		assert.doesNotThrow(() =>
			validateConfig(
				{
					bullet_order: [
						'senior-it-systems-engineering-manager-digital-experience/2',
						'senior-manager-it/0',
						'senior-it-systems-engineering-manager-digital-experience/0',
					],
				},
				'variant.json',
				vocabularies,
			),
		);
	});

	it('rejects an item that is not "<entry id>/<n>"', () => {
		for (const item of ['senior-manager-it', 'senior-manager-it/01', 'senior-manager-it/-1', 3]) {
			assert.throws(
				() => validateConfig({ bullet_order: [item] }, 'variant.json', vocabularies),
				/must be "<entry id>\/<n>"/,
				String(item),
			);
		}
	});

	it('rejects an unknown entry id', () => {
		assert.throws(
			() => validateConfig({ bullet_order: ['no-such-role/0'] }, 'variant.json', vocabularies),
			/unknown entry id "no-such-role" in "no-such-role\/0"/,
		);
	});

	it('rejects an item listed twice', () => {
		assert.throws(
			() =>
				validateConfig(
					{ bullet_order: ['senior-manager-it/0', 'senior-manager-it/0'] },
					'variant.json',
					vocabularies,
				),
			/"senior-manager-it\/0" is listed more than once/,
		);
	});
});

describe('buildTransform bullet_order', () => {
	it('keeps each listed bullet under its own entry, in queue order', async () => {
		const document = await runSerializedTransform({
			bullet_order: ['entry-two/0', 'entry-one/1', 'entry-one/0'],
		});

		// entry-two's bullet leads the queue but stays under entry-two.
		assert.deepEqual(bulletTexts(document), ['Second bullet', 'First bullet', 'Third bullet']);
	});

	it('drops every bullet the queue leaves out', async () => {
		const document = await runSerializedTransform({
			bullet_order: ['entry-one/1', 'entry-two/0'],
		});

		assert.deepEqual(bulletTexts(document), ['Second bullet', 'Third bullet']);
	});

	it('keeps every bullet the facets pass when there is no bullet_order', async () => {
		assert.deepEqual(bulletTexts(await runSerializedTransform({})), [
			'First bullet',
			'Second bullet',
			'Third bullet',
		]);
		// Untagged bullets always render.
		assert.deepEqual(bulletTexts(await runSerializedTransform({ include_facets: ['platform-ops'] })), [
			'Second bullet',
			'Third bullet',
		]);
	});

	it('counts bullets as written, so facets never renumber the queue', async () => {
		const document = await runSerializedTransform({
			include_facets: ['platform-ops'],
			bullet_order: ['entry-one/1', 'entry-two/0'],
		});

		assert.deepEqual(bulletTexts(document), ['Second bullet', 'Third bullet']);
	});

	it('rejects a listed bullet the facets exclude', async () => {
		await assert.rejects(
			() => runSerializedTransform({ include_facets: ['platform-ops'], bullet_order: ['entry-one/0'] }),
			/bullet_order: "entry-one\/0" lists a bullet the facets exclude/,
		);
	});

	it('drops every bullet of an entry the queue never names and warns, keeping the admin line and scope', async t => {
		const warn = t.mock.method(console, 'warn', () => {});
		const document = await runSerializedTransform({
			bullet_order: ['entry-two/0'],
		});

		assert.equal(document.querySelectorAll('#entry-one + p + ul li').length, 0);
		assert.equal(document.querySelectorAll('#entry-one strong').length, 3);
		assert.equal(document.querySelector('.resume-content p').textContent, 'Scope paragraph.');
		assert.deepEqual(bulletTexts(document), ['Third bullet']);
		assert.equal(warn.mock.callCount(), 1);
		assert.match(warn.mock.calls[0].arguments[0], /entry "entry-one" left with no bullets/);
	});

	it('rejects an index past the end of its entry', async () => {
		await assert.rejects(
			() => runSerializedTransform({ bullet_order: ['entry-one/2'] }),
			/bullet_order: "entry-one\/2" is past the end of "entry-one", which has 2 bullet\(s\)/,
		);
		await assert.rejects(
			() => runSerializedTransform({ bullet_order: ['degree-school/0'] }),
			/"degree-school\/0" is past the end of "degree-school", which has 0 bullet\(s\)/,
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
