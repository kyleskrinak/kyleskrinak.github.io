import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
	parsePreviewPort,
	portIsLive,
	resolveSiteUrl,
	rewriteToProductionUrl,
	startPreview,
	waitForServer,
} from '../../scripts/lib/pdf-helpers.mjs';

/** Start a throwaway server on an OS-assigned port; resolves to { port, close }. */
function listenOnFreePort(handler = (_req, res) => res.end('ok')) {
	return new Promise(resolve => {
		const server = http.createServer(handler);
		server.listen(0, '127.0.0.1', () => {
			resolve({
				port: server.address().port,
				close: () => new Promise(done => server.close(done)),
			});
		});
	});
}

describe('parsePreviewPort', () => {
	it('falls back when the variable is unset, and reads it when set', () => {
		assert.equal(parsePreviewPort('RESUME_PREVIEW_PORT', 4323, {}), 4323);
		assert.equal(parsePreviewPort('ARCHIVE_PREVIEW_PORT', 4324, {}), 4324);
		assert.equal(
			parsePreviewPort('RESUME_PREVIEW_PORT', 4323, { RESUME_PREVIEW_PORT: '5555' }),
			5555,
		);
	});

	it('names the offending variable when the value is invalid', () => {
		assert.throws(
			() => parsePreviewPort('ARCHIVE_PREVIEW_PORT', 4324, { ARCHIVE_PREVIEW_PORT: 'abc' }),
			/Invalid ARCHIVE_PREVIEW_PORT/,
		);
		assert.throws(
			() => parsePreviewPort('RESUME_PREVIEW_PORT', 4323, { RESUME_PREVIEW_PORT: '70000' }),
			/must be an integer 1-65535/,
		);
	});

	// No default may be 4321: that is the dev server's port, and a PDF script
	// defaulting there collides with a running `astro dev` by construction.
	it('is never given the dev port as a fallback by its callers', () => {
		assert.notEqual(parsePreviewPort('RESUME_PREVIEW_PORT', 4323, {}), 4321);
		assert.notEqual(parsePreviewPort('ARCHIVE_PREVIEW_PORT', 4324, {}), 4321);
	});
});

describe('portIsLive', () => {
	it('reports a listening port as live and a free one as not', async () => {
		const server = await listenOnFreePort();
		try {
			assert.equal(await portIsLive(server.port), true);
		} finally {
			await server.close();
		}
		// Same port, now closed. Nothing else can have claimed it in between
		// within this process, so this also proves the probe is not stubbed true.
		assert.equal(await portIsLive(server.port), false);
	});
});

describe('startPreview', () => {
	// The failure this prevents: `astro preview` exits without binding an
	// occupied port, and the caller then renders whatever else is answering it.
	it('refuses to spawn onto an occupied port', async () => {
		const server = await listenOnFreePort();
		try {
			await assert.rejects(
				() => startPreview(server.port),
				/already in use/,
			);
		} finally {
			await server.close();
		}
	});
});

describe('waitForServer', () => {
	// Regression: the child-exit check at the top of the loop runs *before* the
	// first fetch, so a server that was already up answers immediately and the
	// child's exit is never observed. This stub is alive when the loop checks and
	// dead by the time the response lands -- exactly the real ordering when
	// `astro preview` declines an occupied port while another server answers it.
	it('rejects when the port answers but the spawned child has exited', async () => {
		// The child "exits" the moment the server handles a request, so the loop's
		// pre-fetch check is guaranteed to have seen it alive.
		let exited = false;
		const server = await listenOnFreePort((_req, res) => {
			exited = true;
			res.end('ok');
		});
		const child = {
			get exitCode() {
				return exited ? 0 : null;
			},
		};
		try {
			await assert.rejects(
				() => waitForServer(`http://127.0.0.1:${server.port}/`, { child, timeoutMs: 5000 }),
				/not by this run's preview/,
			);
		} finally {
			await server.close();
		}
	});

	// The pre-fetch check still catches a child that was already gone.
	it('rejects when the child exited before the first poll', async () => {
		const server = await listenOnFreePort();
		try {
			await assert.rejects(
				() =>
					waitForServer(`http://127.0.0.1:${server.port}/`, {
						child: { exitCode: 0 },
						timeoutMs: 5000,
					}),
				/exited with code 0 before becoming ready/,
			);
		} finally {
			await server.close();
		}
	});

	it('resolves when the port answers and the child is still running', async () => {
		const server = await listenOnFreePort();
		try {
			await waitForServer(`http://127.0.0.1:${server.port}/`, {
				child: { exitCode: null }, // never exits
				timeoutMs: 5000,
			});
		} finally {
			await server.close();
		}
	});

	it('accepts a 404 as ready', async () => {
		const server = await listenOnFreePort((_req, res) => {
			res.statusCode = 404;
			res.end('nope');
		});
		try {
			await waitForServer(`http://127.0.0.1:${server.port}/`, {
				child: { exitCode: null }, // never exits
				timeoutMs: 5000,
			});
		} finally {
			await server.close();
		}
	});
});

describe('a bad port in the environment fails cleanly', () => {
	// parsePreviewPort throws. If a script calls it at module scope, the throw
	// escapes main().catch and Node prints a raw stack trace -- the script's
	// error handling never runs. These spawn the real scripts to prove the parse
	// happens somewhere the handler can see it. Guarding the helper alone would
	// not catch a regression here: the defect is *where* it is called.
	const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

	function run(script, env) {
		return new Promise(resolve => {
			execFile(
				process.execPath,
				[path.join(ROOT, 'scripts', script)],
				{ cwd: ROOT, env: { ...process.env, ...env } },
				(err, stdout, stderr) => resolve({ code: err ? err.code : 0, stdout, stderr }),
			);
		});
	}

	for (const [script, envVar, bad] of [
		['print-resume-pdf.mjs', 'RESUME_PREVIEW_PORT', 'abc'],
		['build-archive-pdf.mjs', 'ARCHIVE_PREVIEW_PORT', '99999'],
		['build-resume-variant.mjs', 'RESUME_PREVIEW_PORT', '0'],
	]) {
		it(`${script} reports ${envVar} without a stack trace`, async () => {
			const { code, stderr } = await run(script, { [envVar]: bad });
			assert.equal(code, 2, `expected exit 2, got ${code}: ${stderr}`);
			assert.match(stderr, new RegExp(`Invalid ${envVar}`));
			assert.doesNotMatch(stderr, /^\s+at /m, 'a stack trace reached the user');
		});
	}
});

/*
 * resolveSiteUrl / rewriteToProductionUrl
 *
 * Chromium writes the resolved absolute URL into every PDF link annotation, so
 * the origin a page was rendered from ships in the file. These two builders
 * render against local preview servers, which is how localhost URLs reached
 * readers (issue #368).
 */

// What the archive book resolves against locally, and what it should resolve
// against in the PDF. Same path in both: only the origin is wrong there.
const ARCHIVE = {
	localDocBase: 'http://localhost:4324/archive-book/',
	prodDocBase: 'https://kyle.skrinak.com/archive-book/',
	localOrigins: ['http://localhost:4324'],
};

// The combined deck document is assembled at the server root while the decks are
// served from /presentations/, so the production base carries a path the local
// one does not. An origin swap alone would not fix these.
const DECKS = {
	localDocBase: 'http://127.0.0.1:51245/',
	prodDocBase: 'https://kyle.skrinak.com/presentations/',
	localOrigins: ['http://127.0.0.1:51245'],
};

describe('resolveSiteUrl', () => {
	it('honours SITE_URL', () => {
		assert.equal(resolveSiteUrl({ SITE_URL: 'https://staging.example.com/' }), 'https://staging.example.com');
	});

	it('falls back to the production site when SITE_URL is unset', () => {
		assert.equal(resolveSiteUrl({}), 'https://kyle.skrinak.com');
	});

	it('treats a blank SITE_URL as unset, however it was spelled', () => {
		// An empty value and a whitespace-only one are the same mistake: a .env
		// line with nothing after the "=", or a CI expression that expanded to
		// nothing. Both fall back rather than failing the build.
		assert.equal(resolveSiteUrl({ SITE_URL: '' }), 'https://kyle.skrinak.com');
		assert.equal(resolveSiteUrl({ SITE_URL: '   ' }), 'https://kyle.skrinak.com');
		assert.equal(resolveSiteUrl({ SITE_URL: '\t\n' }), 'https://kyle.skrinak.com');
	});

	it('still trims a real value rather than rejecting it', () => {
		assert.equal(resolveSiteUrl({ SITE_URL: '  https://example.com/  ' }), 'https://example.com');
	});

	it('strips trailing slashes so callers can append a path', () => {
		assert.equal(resolveSiteUrl({ SITE_URL: 'https://kyle.skrinak.com///' }), 'https://kyle.skrinak.com');
	});

	it('keeps a subdirectory path if one is configured', () => {
		assert.equal(resolveSiteUrl({ SITE_URL: 'https://example.com/blog/' }), 'https://example.com/blog');
	});

	it('throws on a value that is not an absolute URL', () => {
		assert.throws(() => resolveSiteUrl({ SITE_URL: 'kyle.skrinak.com' }), /not a valid absolute URL/);
	});

	it('rejects schemes that cannot serve a published page', () => {
		assert.throws(() => resolveSiteUrl({ SITE_URL: 'file:///tmp/site/' }), /must be http or https/);
		assert.throws(() => resolveSiteUrl({ SITE_URL: 'ftp://example.com/' }), /must be http or https/);
	});
});

describe('rewriteToProductionUrl', () => {
	it('rewrites a root-relative link in the archive book', () => {
		assert.equal(
			rewriteToProductionUrl('/posts/2018-10-13-n-1/', ARCHIVE),
			'https://kyle.skrinak.com/posts/2018-10-13-n-1/'
		);
	});

	it('rewrites an absolute localhost link, dropping the preview port', () => {
		assert.equal(
			rewriteToProductionUrl('http://localhost:4324/blog-archive.pdf', ARCHIVE),
			'https://kyle.skrinak.com/blog-archive.pdf'
		);
	});

	it('rewrites a protocol-relative local link', () => {
		assert.equal(
			rewriteToProductionUrl('//localhost:4324/posts/x/', ARCHIVE),
			'https://kyle.skrinak.com/posts/x/'
		);
	});

	it('restores the /presentations/ prefix a deck-relative link loses', () => {
		assert.equal(
			rewriteToProductionUrl('tts-profile-mgmt.html', DECKS),
			'https://kyle.skrinak.com/presentations/tts-profile-mgmt.html'
		);
	});

	it('resolves a deck link that climbs out of /presentations/', () => {
		assert.equal(
			rewriteToProductionUrl('../posts/2022-04-07-code-presentation/', DECKS),
			'https://kyle.skrinak.com/posts/2022-04-07-code-presentation/'
		);
	});

	it('preserves query and fragment through the swap', () => {
		assert.equal(
			rewriteToProductionUrl('/search/?q=drupal#results', ARCHIVE),
			'https://kyle.skrinak.com/search/?q=drupal#results'
		);
	});

	// The href above is root-relative, so it resolves against the production base
	// and never reaches the branch that reassembles an already-absolute URL by
	// hand. That branch needs its own coverage.
	it('preserves query and fragment on an already-absolute local link', () => {
		assert.equal(
			rewriteToProductionUrl('http://localhost:4324/search/?q=drupal#results', ARCHIVE),
			'https://kyle.skrinak.com/search/?q=drupal#results'
		);
	});

	// A path beginning with `//` reads as protocol-relative if it is re-parsed as
	// a relative reference, which silently swaps the production origin for
	// whatever the path names. It must stay a path.
	it('keeps the production origin when the path itself starts with //', () => {
		assert.equal(
			rewriteToProductionUrl('http://localhost:4324//evil.example/x', ARCHIVE),
			'https://kyle.skrinak.com//evil.example/x'
		);
	});

	it('leaves a genuinely external link alone', () => {
		assert.equal(rewriteToProductionUrl('https://www.youtube.com/watch?v=EJo9tPXGPo8', ARCHIVE), null);
	});

	it('leaves an already-absolute production link alone', () => {
		assert.equal(rewriteToProductionUrl('https://kyle.skrinak.com/posts/x/', ARCHIVE), null);
	});

	it('is idempotent: its own output is never rewritten again', () => {
		const once = rewriteToProductionUrl('/posts/x/', ARCHIVE);
		assert.equal(rewriteToProductionUrl(once, ARCHIVE), null);
	});

	it('leaves a bare fragment alone, which Chromium emits as an internal PDF destination', () => {
		assert.equal(rewriteToProductionUrl('#user-content-fn-1', ARCHIVE), null);
		assert.equal(rewriteToProductionUrl('#deck-3', DECKS), null);
	});

	for (const href of ['mailto:trinitywebsupport@duke.edu', 'tel:+19195551212', 'javascript:void(0)', 'data:text/plain,x']) {
		it(`leaves ${href.split(':')[0]}: alone`, () => {
			assert.equal(rewriteToProductionUrl(href, ARCHIVE), null);
		});
	}

	// A string prefix test would treat every one of these as local. URL.origin
	// cannot, because the host has already ended by that point.
	for (const href of [
		'http://localhost.example.com/x',
		'http://localhost:4324.example.com/x',
		'http://127.0.0.1.evil.com/x',
		'https://notlocalhost:4324/x',
	]) {
		it(`does not treat the lookalike host ${href} as local`, () => {
			assert.equal(rewriteToProductionUrl(href, ARCHIVE), null);
		});
	}

	it('does not treat a different local port as local', () => {
		assert.equal(rewriteToProductionUrl('http://localhost:9999/x', ARCHIVE), null);
	});

	for (const [label, href] of [['null', null], ['undefined', undefined], ['empty', ''], ['whitespace', '   ']]) {
		it(`returns null for an ${label} href`, () => {
			assert.equal(rewriteToProductionUrl(href, ARCHIVE), null);
		});
	}

	it('returns null rather than throwing on an unparseable href', () => {
		assert.equal(rewriteToProductionUrl('http://[unclosed', ARCHIVE), null);
	});
});
