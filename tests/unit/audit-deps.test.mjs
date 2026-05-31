import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
	pathToName,
	formatAge,
	extractPackages,
	classifyDelta,
	detectDormantRevival,
	previousPublishedVersion,
} from '../../scripts/audit-deps.mjs';

describe('pathToName', () => {
	it('handles a flat package path', () => {
		assert.equal(pathToName('node_modules/foo'), 'foo');
	});

	it('handles a scoped package path', () => {
		assert.equal(pathToName('node_modules/@scope/foo'), '@scope/foo');
	});

	it('handles a nested flat package (LAST node_modules wins)', () => {
		assert.equal(pathToName('node_modules/foo/node_modules/bar'), 'bar');
	});

	it('handles a nested scoped package', () => {
		assert.equal(pathToName('node_modules/foo/node_modules/@scope/bar'), '@scope/bar');
	});

	it('returns workspace paths unchanged when node_modules/ is absent', () => {
		assert.equal(pathToName('packages/foo'), 'packages/foo');
	});

	it('returns scoped name for deeply nested scoped path', () => {
		assert.equal(
			pathToName('node_modules/@a/b/node_modules/@c/d/node_modules/@e/f'),
			'@e/f',
		);
	});

	it('falls back to first segment when scope marker has no second segment', () => {
		// Malformed input — should not throw.
		assert.equal(pathToName('node_modules/@scope'), '@scope');
	});
});

describe('formatAge', () => {
	it('returns "unknown" for empty/null input', () => {
		assert.equal(formatAge(''), 'unknown');
		assert.equal(formatAge(null), 'unknown');
		assert.equal(formatAge(undefined), 'unknown');
	});

	it('returns "today" for an ISO date less than 24h old', () => {
		const recent = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
		assert.equal(formatAge(recent), 'today');
	});

	it('returns "today" for a future ISO date (negative ageMs)', () => {
		// Malformed registry response could yield a future publish time.
		// Math.floor(negative / 86400000) < 1, so we hit the "today" branch.
		// This test locks in that behavior — invalid input is degraded, not crashed.
		const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(); // +7 days
		assert.equal(formatAge(future), 'today');
	});

	it('returns "1 day" for exactly one day old', () => {
		const oneDay = new Date(Date.now() - 1000 * 60 * 60 * 24 - 1000).toISOString();
		assert.equal(formatAge(oneDay), '1 day');
	});

	it('returns plural days for under 30 days', () => {
		const fiveDays = new Date(Date.now() - 5 * 86400000 - 1000).toISOString();
		assert.equal(formatAge(fiveDays), '5 days');
	});

	it('returns months for between 30 and 365 days', () => {
		// -1000ms offset matches the other date-relative tests: keeps the value clear
		// of the exact 90-day boundary regardless of execution timing.
		const threeMonths = new Date(Date.now() - 90 * 86400000 - 1000).toISOString();
		assert.equal(formatAge(threeMonths), '3 mo');
	});

	it('returns years for >= 12 months, formatted to 1 decimal', () => {
		const twoYears = new Date(Date.now() - 2 * 365.25 * 86400000).toISOString();
		assert.equal(formatAge(twoYears), '2.0 yr');
	});
});

describe('extractPackages', () => {
	it('returns an empty Map for null input', () => {
		const m = extractPackages(null);
		assert.equal(m.size, 0);
	});

	it('returns an empty Map for a lockfile with no packages key', () => {
		const m = extractPackages({});
		assert.equal(m.size, 0);
	});

	it('skips the root project entry (path === "")', () => {
		const lock = {
			packages: {
				'': { version: '1.0.0', name: 'root-project' },
				'node_modules/foo': { version: '2.3.4' },
			},
		};
		const m = extractPackages(lock);
		assert.equal(m.size, 1);
		assert.deepEqual(m.get('node_modules/foo'), { version: '2.3.4', resolved: '', integrity: '' });
	});

	it('skips entries without a version', () => {
		const lock = {
			packages: {
				'node_modules/foo': { version: '1.0.0' },
				'node_modules/bar': { resolved: 'some-url' }, // no version
			},
		};
		const m = extractPackages(lock);
		assert.equal(m.size, 1);
		assert.ok(m.has('node_modules/foo'));
		assert.ok(!m.has('node_modules/bar'));
	});

	it('preserves resolved and integrity when present', () => {
		const lock = {
			packages: {
				'node_modules/foo': {
					version: '1.0.0',
					resolved: 'https://registry.npmjs.org/foo/-/foo-1.0.0.tgz',
					integrity: 'sha512-abc123',
				},
			},
		};
		const m = extractPackages(lock);
		assert.equal(m.get('node_modules/foo').resolved, 'https://registry.npmjs.org/foo/-/foo-1.0.0.tgz');
		assert.equal(m.get('node_modules/foo').integrity, 'sha512-abc123');
	});
});

describe('classifyDelta', () => {
	const pkg = (version, resolved = 'https://r.npmjs.org/foo.tgz', integrity = 'sha512-abc') =>
		new Map([['node_modules/foo', { version, resolved, integrity }]]);

	it('returns empty arrays when before and after are identical', () => {
		const before = pkg('1.0.0');
		const after = pkg('1.0.0');
		const r = classifyDelta(before, after);
		assert.equal(r.added.length, 0);
		assert.equal(r.removed.length, 0);
		assert.equal(r.changed.length, 0);
		assert.equal(r.tampered.length, 0);
	});

	it('detects an added package', () => {
		const before = new Map();
		const after = pkg('1.0.0');
		const r = classifyDelta(before, after);
		assert.equal(r.added.length, 1);
		assert.equal(r.added[0].path, 'node_modules/foo');
	});

	it('detects a removed package', () => {
		const before = pkg('1.0.0');
		const after = new Map();
		const r = classifyDelta(before, after);
		assert.equal(r.removed.length, 1);
	});

	it('detects a version change', () => {
		const before = pkg('1.0.0');
		const after = pkg('1.1.0');
		const r = classifyDelta(before, after);
		assert.equal(r.changed.length, 1);
		assert.equal(r.changed[0].from, '1.0.0');
		assert.equal(r.changed[0].to, '1.1.0');
		assert.equal(r.tampered.length, 0);
	});

	it('flags same-version resolved change as tampered', () => {
		const before = pkg('1.0.0', 'https://legitimate.registry/foo.tgz');
		const after = pkg('1.0.0', 'https://attacker.example/foo.tgz');
		const r = classifyDelta(before, after);
		assert.equal(r.tampered.length, 1);
		assert.equal(r.tampered[0].version, '1.0.0');
		assert.equal(r.tampered[0].prevResolved, 'https://legitimate.registry/foo.tgz');
		assert.equal(r.tampered[0].resolved, 'https://attacker.example/foo.tgz');
		assert.equal(r.changed.length, 0);
	});

	it('flags same-version integrity change as tampered', () => {
		const before = pkg('1.0.0', 'https://r.npmjs.org/foo.tgz', 'sha512-original');
		const after = pkg('1.0.0', 'https://r.npmjs.org/foo.tgz', 'sha512-swapped');
		const r = classifyDelta(before, after);
		assert.equal(r.tampered.length, 1);
		assert.equal(r.tampered[0].prevIntegrity, 'sha512-original');
		assert.equal(r.tampered[0].integrity, 'sha512-swapped');
	});

	it('does not flag a version bump as tampered even when resolved/integrity change', () => {
		const before = pkg('1.0.0', 'https://r.npmjs.org/foo-1.0.0.tgz', 'sha512-old');
		const after = pkg('1.1.0', 'https://r.npmjs.org/foo-1.1.0.tgz', 'sha512-new');
		const r = classifyDelta(before, after);
		assert.equal(r.changed.length, 1);
		assert.equal(r.tampered.length, 0);
	});
});

describe('detectDormantRevival', () => {
	const day = 86400000;

	it('returns null when prev timestamp is missing', () => {
		assert.equal(detectDormantRevival(null, '2026-01-01T00:00:00Z'), null);
		assert.equal(detectDormantRevival('', '2026-01-01T00:00:00Z'), null);
	});

	it('returns null when new timestamp is missing', () => {
		assert.equal(detectDormantRevival('2020-01-01T00:00:00Z', null), null);
		assert.equal(detectDormantRevival('2020-01-01T00:00:00Z', ''), null);
	});

	it('returns null for a gap below the threshold', () => {
		const prev = new Date(Date.now() - 100 * day).toISOString();
		const now = new Date().toISOString();
		assert.equal(detectDormantRevival(prev, now), null);
	});

	it('returns an object when the gap reaches the threshold exactly', () => {
		const result = detectDormantRevival(
			'2020-01-01T00:00:00Z',
			'2020-01-01T00:00:00Z',
			0,
		);
		assert.ok(result);
		assert.equal(result.gapDays, 0);
	});

	it('returns gapYears matching gapDays / 365.25 for a multi-year gap', () => {
		const result = detectDormantRevival(
			'2020-01-01T00:00:00Z',
			'2023-01-01T00:00:00Z',
		);
		assert.ok(result);
		// ~3 years
		assert.ok(result.gapYears > 2.9 && result.gapYears < 3.1);
		assert.equal(result.gapDays / 365.25, result.gapYears);
	});

	it('honors a custom threshold passed as the third argument', () => {
		const prev = new Date(Date.now() - 10 * day).toISOString();
		const now = new Date().toISOString();
		// Default threshold (730.5 days) → null
		assert.equal(detectDormantRevival(prev, now), null);
		// Custom 5-day threshold → returns object
		assert.ok(detectDormantRevival(prev, now, 5));
	});
});

describe('previousPublishedVersion', () => {
	it('returns null for a null time map', () => {
		assert.equal(previousPublishedVersion(null, '1.0.0'), null);
	});

	it('returns null when the target version is absent from the map', () => {
		const timeMap = { created: '2020-01-01T00:00:00Z', '1.0.0': '2020-01-01T00:00:00Z' };
		assert.equal(previousPublishedVersion(timeMap, '2.0.0'), null);
	});

	it('returns null when the target is the only published version', () => {
		const timeMap = {
			created: '2020-01-01T00:00:00Z',
			modified: '2020-01-01T00:00:00Z',
			'1.0.0': '2020-01-01T00:00:00Z',
		};
		assert.equal(previousPublishedVersion(timeMap, '1.0.0'), null);
	});

	it('skips the created/modified keys and returns the immediately prior release', () => {
		const timeMap = {
			created: '2018-01-01T00:00:00Z',
			modified: '2024-01-01T00:00:00Z',
			'1.0.0': '2018-01-01T00:00:00Z',
			'1.1.0': '2019-06-01T00:00:00Z',
			'2.0.0': '2024-01-01T00:00:00Z', // target
		};
		assert.deepEqual(previousPublishedVersion(timeMap, '2.0.0'), {
			version: '1.1.0',
			iso: '2019-06-01T00:00:00Z',
		});
	});

	it('ignores versions published at or after the target time', () => {
		const timeMap = {
			'1.0.0': '2020-01-01T00:00:00Z',
			'1.5.0': '2021-01-01T00:00:00Z', // target
			'2.0.0': '2022-01-01T00:00:00Z', // later — must be ignored
		};
		assert.deepEqual(previousPublishedVersion(timeMap, '1.5.0'), {
			version: '1.0.0',
			iso: '2020-01-01T00:00:00Z',
		});
	});

	it('feeds detectDormantRevival to flag a long-dormant newly added package', () => {
		// A package whose last release was 2017, suddenly republishing in 2024 — the
		// exact takeover pattern the tool must catch on a freshly added dependency.
		const timeMap = {
			created: '2015-01-01T00:00:00Z',
			'0.9.0': '2017-01-01T00:00:00Z',
			'1.0.0': '2024-01-01T00:00:00Z', // newly added target
		};
		const prior = previousPublishedVersion(timeMap, '1.0.0');
		assert.deepEqual(prior, { version: '0.9.0', iso: '2017-01-01T00:00:00Z' });
		const revival = detectDormantRevival(prior.iso, timeMap['1.0.0']);
		assert.ok(revival, 'a ~7yr gap on a new package must trip the revival check');
		assert.ok(revival.gapYears > 6.9 && revival.gapYears < 7.1);
	});
});

describe('CLI --base mode', () => {
	// Regression guard: --base <ref> on a clean working tree must NOT exit early
	// with the dirty-check "Nothing to audit" message. It must reach the Scope
	// output and proceed to audit (even when the diff is empty). Covers the
	// if(pkgSpec)/else-if(!baseRef)/else dispatch added in the --base fix.
	it('--base HEAD on a clean working tree bypasses the dirty-check early exit', { timeout: 90_000 }, () => {
		const scriptPath = fileURLToPath(new URL('../../scripts/audit-deps.mjs', import.meta.url));
		const result = spawnSync(process.execPath, [scriptPath, '--base', 'HEAD'], {
			encoding: 'utf8',
			timeout: 90_000,
		});
		// The dirty-check early exit emits this exact phrase; the post-diff no-changes
		// message is different ("No lockfile changes. Nothing to audit.").
		assert.ok(
			!result.stdout.includes('Nothing to audit. Exiting cleanly.'),
			`--base mode exited early via dirty-check path:\n${result.stdout}`,
		);
		assert.ok(
			result.stdout.includes('Base ref: HEAD'),
			`Expected "Base ref: HEAD" in Scope output:\n${result.stdout}`,
		);
	});
});
