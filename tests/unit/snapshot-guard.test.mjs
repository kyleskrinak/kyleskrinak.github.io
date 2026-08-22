import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	argvRequestsSnapshotWrites,
	overwritesBaselines,
	OVERWRITING_MODES,
} from '../snapshot-guard-modes.mjs';

// argv as Playwright sees it: node, the binary, then the user's arguments.
const argv = (...args) => ['node', 'playwright', 'test', ...args];

test('overwritesBaselines covers exactly the destructive modes', () => {
	assert.deepEqual(OVERWRITING_MODES, ['all', 'changed']);
	assert.equal(overwritesBaselines('all'), true);
	assert.equal(overwritesBaselines('changed'), true);
	// The default for every ordinary run; only creates absent snapshots.
	assert.equal(overwritesBaselines('missing'), false);
	assert.equal(overwritesBaselines('none'), false);
});

test('detects long-form update flags', () => {
	assert.equal(argvRequestsSnapshotWrites(argv('--update-snapshots')), true);
	assert.equal(argvRequestsSnapshotWrites(argv('--update-snapshots=all')), true);
	assert.equal(argvRequestsSnapshotWrites(argv('--update-snapshots=changed')), true);
	assert.equal(argvRequestsSnapshotWrites(argv('--update-snapshots=missing')), false);
	assert.equal(argvRequestsSnapshotWrites(argv('--update-snapshots=none')), false);
});

test('detects short flags, including attached values and clusters', () => {
	// Each of these reaches --update-snapshots; -uall and -xu were live bypasses.
	assert.equal(argvRequestsSnapshotWrites(argv('-u')), true);
	assert.equal(argvRequestsSnapshotWrites(argv('-uall')), true);
	assert.equal(argvRequestsSnapshotWrites(argv('-uchanged')), true);
	assert.equal(argvRequestsSnapshotWrites(argv('-xu')), true);
	assert.equal(argvRequestsSnapshotWrites(argv('-xuall')), true);
	assert.equal(argvRequestsSnapshotWrites(argv('-unone')), false);
	assert.equal(argvRequestsSnapshotWrites(argv('-umissing')), false);
});

test('a value-consuming short flag swallows the rest of its cluster', () => {
	// `-gu` is grep="u", not an update flag; treating it as one would block a valid run.
	assert.equal(argvRequestsSnapshotWrites(argv('-gu')), false);
	assert.equal(argvRequestsSnapshotWrites(argv('-cu')), false);
	assert.equal(argvRequestsSnapshotWrites(argv('-ju')), false);
	// -G is --grep-invert and swallows the cluster exactly like -g.
	assert.equal(argvRequestsSnapshotWrites(argv('-Gu')), false);
	assert.equal(argvRequestsSnapshotWrites(argv('-Guall')), false);
	// `-ug` is not a bypass either: -u swallows 'g' as its mode, and Playwright rejects
	// it ("argument 'g' is invalid"), so there is no run to guard.
	assert.equal(argvRequestsSnapshotWrites(argv('-ug')), false);
});

test('every occurrence counts, not just the first', () => {
	// Playwright takes the last flag, so a leading =none must not mask a later =all.
	assert.equal(
		argvRequestsSnapshotWrites(argv('--update-snapshots=none', '--update-snapshots=all')),
		true
	);
	// The reverse is refused too: erring toward refusing costs a re-run, while the
	// other direction silently poisons committed baselines.
	assert.equal(
		argvRequestsSnapshotWrites(argv('--update-snapshots=all', '--update-snapshots=none')),
		true
	);
});

test('a separate-token mode is read as the mode', () => {
	assert.equal(argvRequestsSnapshotWrites(argv('--update-snapshots', 'all')), true);
	assert.equal(argvRequestsSnapshotWrites(argv('--update-snapshots', 'none')), false);
	// A following flag is not a mode, so a bare -u falls back to 'changed'.
	assert.equal(argvRequestsSnapshotWrites(argv('-u', '--list')), true);
});

test('ordinary runs are untouched', () => {
	assert.equal(argvRequestsSnapshotWrites(argv()), false);
	assert.equal(argvRequestsSnapshotWrites(argv('--project=seo')), false);
	assert.equal(argvRequestsSnapshotWrites(argv('-g', 'home')), false);
	assert.equal(argvRequestsSnapshotWrites(argv('--grep', 'update-snapshots')), false);
});
