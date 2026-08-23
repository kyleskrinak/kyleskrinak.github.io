import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
	findCreated,
	overwritesBaselines,
	removeCreated,
	snapshotFilesUnder,
} from '../snapshot-guard.mjs';

/**
 * These cover the mechanics directly rather than through the hooks, because the hooks
 * no-op on Linux (guardActive) and CI is Linux -- routed through them, none of this
 * would be exercised anywhere it runs.
 */
const withTree = (fn) => {
	const root = mkdtempSync(join(tmpdir(), 'snapshot-guard-test-'));
	try {
		return fn(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
};

const touch = (path, body = 'x') => {
	mkdirSync(join(path, '..'), { recursive: true });
	writeFileSync(path, body);
	return path;
};

test('scan finds only files inside -snapshots directories', () => {
	withTree((root) => {
		const inside = touch(join(root, 'visual', 'a.spec.ts-snapshots', 'one.png'));
		const nested = touch(join(root, 'visual', 'a.spec.ts-snapshots', 'deep', 'two.png'));
		touch(join(root, 'visual', 'a.spec.ts'));
		touch(join(root, 'notes.md'));

		assert.deepEqual(snapshotFilesUnder(root), [inside, nested].sort());
	});
});

test('scan treats a missing root as empty', () => {
	assert.deepEqual(snapshotFilesUnder(join(tmpdir(), 'snapshot-guard-does-not-exist')), []);
});

test('scan fails closed when a path cannot be read as a directory', () => {
	withTree((root) => {
		const file = touch(join(root, 'a-file'));
		// ENOTDIR, not ENOENT: anything but "absent" must surface rather than silently
		// reporting an empty tree, which would hide created snapshots.
		assert.throws(() => snapshotFilesUnder(file), { code: 'ENOTDIR' });
	});
});

test('findCreated reports only files absent at the start', () => {
	withTree((root) => {
		const existing = touch(join(root, 'v.spec.ts-snapshots', 'old.png'));
		const before = snapshotFilesUnder(root);
		const fresh = touch(join(root, 'v.spec.ts-snapshots', 'new.png'));

		assert.deepEqual(findCreated(before, root), [fresh]);
		assert.ok(existsSync(existing));
	});
});

test('removeCreated deletes the files and a directory the run created', () => {
	withTree((root) => {
		const before = snapshotFilesUnder(root);
		const fresh = touch(join(root, 'new.spec.ts-snapshots', 'shot.png'));

		removeCreated(findCreated(before, root));

		assert.equal(existsSync(fresh), false);
		// The whole -snapshots directory was this run's doing, so it goes too.
		assert.equal(existsSync(join(root, 'new.spec.ts-snapshots')), false);
	});
});

test('removeCreated leaves a directory that still holds committed baselines', () => {
	withTree((root) => {
		const committed = touch(join(root, 'v.spec.ts-snapshots', 'committed.png'));
		const before = snapshotFilesUnder(root);
		const fresh = touch(join(root, 'v.spec.ts-snapshots', 'fresh.png'));

		removeCreated(findCreated(before, root));

		assert.equal(existsSync(fresh), false);
		assert.ok(existsSync(committed), 'committed baseline must survive');
		assert.ok(existsSync(join(root, 'v.spec.ts-snapshots')));
	});
});

test('removeCreated tolerates a file already gone', () => {
	withTree((root) => {
		assert.doesNotThrow(() => removeCreated([join(root, 'v.spec.ts-snapshots', 'never.png')]));
	});
});

test('only overwriting modes are refused by mode', () => {
	assert.equal(overwritesBaselines('all'), true);
	assert.equal(overwritesBaselines('changed'), true);
	// The default for every ordinary run; caught after the run instead, if it writes.
	assert.equal(overwritesBaselines('missing'), false);
	assert.equal(overwritesBaselines('none'), false);
});
