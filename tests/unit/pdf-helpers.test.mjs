import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
	parsePreviewPort,
	portIsLive,
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
