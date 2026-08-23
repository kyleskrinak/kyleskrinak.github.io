import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Keep host-rendered snapshots out of the repository.
 *
 * Committed baselines are compared against CI's Ubuntu rendering, whose font stack
 * renders slightly taller than macOS, so a snapshot written anywhere else will fail CI
 * even with no real visual change. Docker and CI are both Linux, so the sanctioned
 * baseline paths (`npm run test:visual:baseline:docker`) are unaffected.
 *
 * The guard is deliberately one idea: compare the snapshot files before and after a
 * run, and delete whatever the run created. It does not try to infer intent from the
 * command line -- an earlier version parsed argv to refuse early, and that parser was
 * the source of repeated bypasses and false positives while never being the thing that
 * actually provided the safety. What a run *did* is observable; what it *meant* is not.
 *
 * Two hooks, both no-ops on Linux and under ALLOW_NATIVE_BASELINE=1:
 *   globalSetup    - refuse an explicit overwrite up front, else record the tree
 *   globalTeardown - delete anything the run created, and fail
 */
export const ALLOW_NATIVE_BASELINE = () => process.env.ALLOW_NATIVE_BASELINE === '1';

/** Linux matches CI's rendering; the env var is the deliberate override. */
export const guardActive = () => process.platform !== 'linux' && !ALLOW_NATIVE_BASELINE();

/**
 * Modes that overwrite baselines which already exist.
 *
 * Excludes 'missing', Playwright's default for every ordinary run: it only fills in
 * snapshots that don't exist yet, so refusing it by mode would block all local testing.
 * The files it does create are caught after the run instead.
 */
/** @param {string} mode */
export const overwritesBaselines = (mode) => mode === 'all' || mode === 'changed';

/** Refuse a run that would overwrite baselines from a host that doesn't match CI. */
/** @param {boolean} writesSnapshots */
export const assertSnapshotWritesAllowed = (writesSnapshots) => {
	if (!writesSnapshots || !guardActive()) return;

	throw new Error(
		[
			`Refusing to write snapshots from a ${process.platform} host.`,
			'',
			"Committed baselines must match CI's Ubuntu rendering. Use:",
			'  npm run test:visual:baseline:docker',
			'',
			'To override anyway (only correct on a Linux host matching CI):',
			'  ALLOW_NATIVE_BASELINE=1 <command>',
		].join('\n')
	);
};

// Keyed by checkout and pid so separate runs never read each other's list.
const manifestPath = () => {
	const key = createHash('sha256').update(process.cwd()).digest('hex').slice(0, 12);
	return join(tmpdir(), `astro-blog-snapshots-${key}-${process.pid}.json`);
};

/**
 * Every file inside a `*-snapshots` directory beneath `root`, sorted.
 * Exported for tests: the mechanics must be checkable on any platform, since the
 * hooks below no-op on Linux and CI would otherwise cover none of this.
 *
 * @param {string} root
 * @returns {string[]}
 */
export const snapshotFilesUnder = (root) => {
	/** @type {string[]} */
	const found = [];
	const walk = (/** @type {string} */ dir, /** @type {boolean} */ inSnapshotDir) => {
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch (error) {
			// A directory that isn't there yet is expected -- the -snapshots tree is
			// created lazily. Anything else (EACCES, EIO) would hide files from the scan
			// and let a host-rendered baseline survive, so fail closed.
			if (error.code === 'ENOENT') return;
			throw error;
		}
		for (const entry of entries) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(full, inSnapshotDir || entry.name.endsWith('-snapshots'));
			} else if (inSnapshotDir) {
				found.push(full);
			}
		}
	};
	walk(root, false);
	return found.sort();
};

/**
 * Snapshot files present now that were absent when the run started.
 *
 * @param {Set<string>|string[]} before
 * @param {string} root
 * @returns {string[]}
 */
export const findCreated = (before, root) => {
	const seen = before instanceof Set ? before : new Set(before);
	return snapshotFilesUnder(root).filter((file) => !seen.has(file));
};

/**
 * Delete files a run created, plus any `-snapshots` directory the run itself created.
 * Callers only ever pass paths that were absent when their run started.
 *
 * @param {string[]} created
 */
export const removeCreated = (created) => {
	for (const file of created) {
		try {
			unlinkSync(file);
		} catch (error) {
			if (error.code !== 'ENOENT') throw error;
		}
	}
	// rmdirSync fails on a non-empty directory, which is wanted: never touch one that
	// still holds committed baselines.
	for (const dir of new Set(created.map((file) => dirname(file)))) {
		try {
			rmdirSync(dir);
		} catch {
			/* still holds committed baselines -- leave it */
		}
	}
};

/** @param {string} root */
export const recordExistingSnapshots = (root) => {
	if (!guardActive()) return;
	mkdirSync(tmpdir(), { recursive: true });
	writeFileSync(manifestPath(), JSON.stringify(snapshotFilesUnder(root)), 'utf8');
};

/** @param {string} root */
export const assertNoSnapshotsCreated = (root) => {
	if (!guardActive()) return;

	const path = manifestPath();
	if (!existsSync(path)) return;

	const before = new Set(JSON.parse(readFileSync(path, 'utf8')));
	rmSync(path, { force: true });

	const created = findCreated(before, root);
	if (created.length === 0) return;

	removeCreated(created);

	throw new Error(
		[
			`Refusing to keep ${created.length} snapshot(s) written from a ${process.platform} host.`,
			'',
			"These had no baseline yet, so Playwright created them from this host's rendering,",
			"which does not match CI's Ubuntu font stack. They have been deleted:",
			...created.map((file) => `  ${file}`),
			'',
			'Generate them where they will match CI:',
			'  npm run test:visual:baseline:docker',
			'',
			'To keep host-rendered snapshots anyway (only correct on a Linux host matching CI):',
			'  ALLOW_NATIVE_BASELINE=1 <command>',
		].join('\n')
	);
};
