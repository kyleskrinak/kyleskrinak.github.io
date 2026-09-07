import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * The `overrides` block in package.json is a security control surface, not a
 * convenience: every entry pins an advisory-affected transitive dependency to the
 * oldest version that resolves its advisory. Renovate edits that block unattended,
 * and nothing else in CI validates it -- package-lock.json is lockfileVersion 3,
 * whose root `packages[""]` entry records no `overrides` key at all, so no tooling
 * compares the declared overrides against the resolved tree.
 *
 * Two real regressions motivate the assertions below:
 *
 *   - 7568222 pinned js-yaml to 4.3.1 for GHSA-5p4m-2wfm-xmqj (quadratic `!!omap`
 *     CPU blowup, affected range >=4.0.0 <4.3.1). A bare tree-wide entry also
 *     dragged markdownlint-cli2 from js-yaml 5.2.2 down to 4.3.1 -- a major
 *     downgrade of a package the advisory never covered -- and `npm ls` reported
 *     ELSPROBLEMS. The nested markdownlint-cli2 exception exists solely to undo
 *     that. Renovate PR #372 later rewrote the exception back to the top-level
 *     value, recreating the exact breakage the carve-out was written to prevent.
 *
 *   - a5e5a21 walked the fast-uri pin across a major boundary with no human review.
 *
 * package.json cannot carry comments, which is what made the carve-out easy to
 * clobber by accident. This file is where that rationale lives.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const readJson = (name) => JSON.parse(readFileSync(join(repoRoot, name), 'utf8'));

const pkg = readJson('package.json');
const lock = readJson('package-lock.json');

/**
 * Oldest version that resolves each advisory, from the commit that introduced the
 * pin. Overrides may be bumped upward freely; dropping below a floor silently
 * reopens the advisory and must fail.
 *
 * c1adf43 -- "pin advisory-affected transitive deps via overrides":
 *   devalue (DoS), fast-uri (path traversal / host confusion),
 *   fast-xml-builder (XML injection), fast-xml-parser, flatted,
 *   brace-expansion, postcss (XSS).
 * 7568222 -- js-yaml, GHSA-5p4m-2wfm-xmqj.
 */
const ADVISORY_FLOORS = {
	devalue: '5.8.1',
	'fast-uri': '3.1.2',
	'fast-xml-builder': '1.1.7',
	'fast-xml-parser': '5.7.0',
	flatted: '3.4.2',
	'brace-expansion': '5.0.6',
	'js-yaml': '4.3.1',
	postcss: '8.5.10',
};

/**
 * Overrides are written as exact pins, so an exact-version comparison is enough.
 * Anything else throws rather than being coerced -- a pin this cannot parse is a
 * pin this cannot vouch for.
 */
const parseExact = (version, label) => {
	const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
	assert.ok(
		match,
		`${label} must be an exact x.y.z pin so its advisory floor can be checked, got "${version}"`,
	);
	return match.slice(1, 4).map(Number);
};

const isAtLeast = (version, floor, label) => {
	const a = parseExact(version, label);
	const b = parseExact(floor, `floor for ${label}`);
	for (let i = 0; i < 3; i += 1) {
		if (a[i] !== b[i]) return a[i] > b[i];
	}
	return true;
};

/**
 * Derived at module load, so they must not throw on malformed input: a bare
 * `Object.entries(undefined)` here would crash the file before any test ran,
 * replacing the deliberate assertion below with an opaque loader error. The raw
 * values stay available so the first test can still report what was actually wrong.
 */
const rawOverrides = pkg.overrides;
const overrides = rawOverrides && typeof rawOverrides === 'object' ? rawOverrides : {};

const rawLockPackages = lock.packages;
const lockPackages = rawLockPackages && typeof rawLockPackages === 'object' ? rawLockPackages : {};

/** Entries whose value is a string: a tree-wide pin for that package. */
const topLevel = Object.entries(overrides).filter(([, value]) => typeof value === 'string');

/** Entries whose value is an object: per-parent exceptions to a tree-wide pin. */
const nested = Object.entries(overrides).filter(
	([, value]) => value && typeof value === 'object' && !Array.isArray(value),
);

/**
 * Every place the lockfile resolves `name`, at any depth, as
 * `{ path, parent, version }`. `parent` is the package the copy is nested under,
 * or null when it is hoisted to the root `node_modules`.
 *
 * Splitting on `/node_modules/` keeps scoped names (`@scope/pkg`) intact, since
 * their slash is not a nesting boundary.
 */
const lockEntriesFor = (name) => {
	const found = [];
	for (const [path, entry] of Object.entries(lockPackages)) {
		if (!path || !entry?.version) continue; // root project entry, or a link/workspace
		const segments = `/${path}`.split('/node_modules/');
		if (segments.at(-1) !== name) continue;
		found.push({
			path,
			parent: segments.length > 2 ? segments.at(-2) : null,
			version: entry.version,
		});
	}
	return found;
};

test('overrides block is present and non-empty', () => {
	assert.ok(
		rawOverrides && typeof rawOverrides === 'object' && !Array.isArray(rawOverrides),
		'package.json must declare an overrides block -- every entry is an advisory pin',
	);
	assert.ok(topLevel.length > 0, 'expected at least one tree-wide override pin');
});

test('lockfile exposes a package map to check against', () => {
	assert.ok(
		rawLockPackages && typeof rawLockPackages === 'object',
		'package-lock.json has no `packages` map, so no override can be verified against the ' +
			'resolved tree. Expected lockfileVersion 2 or 3.',
	);
});

test('every override sits at or above its advisory floor', () => {
	const checked = [];

	for (const [name, version] of topLevel) {
		const floor = ADVISORY_FLOORS[name];
		if (!floor) continue;
		assert.ok(
			isAtLeast(version, floor, `override "${name}"`),
			`override "${name}" is pinned to ${version}, below its advisory floor ${floor}. ` +
				'Bumping upward is fine; dropping below the floor reopens the advisory.',
		);
		checked.push(name);
	}

	// Nested exceptions must clear the same floor -- a carve-out is an exemption
	// from the tree-wide *version*, never from the advisory itself.
	for (const [parent, block] of nested) {
		for (const [name, version] of Object.entries(block)) {
			const floor = ADVISORY_FLOORS[name];
			if (!floor) continue;
			assert.ok(
				isAtLeast(version, floor, `override "${parent}" > "${name}"`),
				`nested override "${parent}" > "${name}" is pinned to ${version}, ` +
					`below its advisory floor ${floor}.`,
			);
		}
	}

	assert.ok(
		checked.length > 0,
		'no override matched a known advisory floor -- ADVISORY_FLOORS has drifted from package.json',
	);
});

test('every known advisory floor still has a matching override', () => {
	// Guards the other direction: a pin silently deleted would otherwise leave this
	// suite green while the advisory went unpinned.
	const pinned = new Set(topLevel.map(([name]) => name));
	for (const name of Object.keys(ADVISORY_FLOORS)) {
		assert.ok(
			pinned.has(name),
			`"${name}" has a recorded advisory floor but no override pin. ` +
				'If the pin was intentionally dropped, remove it from ADVISORY_FLOORS with a note.',
		);
	}
});

test('no nested carve-out has collapsed into its tree-wide pin', () => {
	for (const [parent, block] of nested) {
		for (const [name, version] of Object.entries(block)) {
			const treeWide = overrides[name];
			if (typeof treeWide !== 'string') continue;
			assert.notEqual(
				version,
				treeWide,
				`nested override "${parent}" > "${name}" (${version}) equals the tree-wide ` +
					`pin for "${name}". A carve-out that matches the value it exempts from is ` +
					'the collapse signature seen in PR #372 -- either it was rewritten by ' +
					'mistake, or it is now redundant and should be deleted deliberately.',
			);
		}
	}
});

test('markdownlint-cli2 keeps its js-yaml 5.x carve-out', () => {
	const carveOut = overrides['markdownlint-cli2']?.['js-yaml'];
	assert.ok(
		carveOut,
		'the markdownlint-cli2 > js-yaml carve-out is missing. Without it the tree-wide ' +
			'js-yaml pin downgrades markdownlint-cli2 across a major boundary (7568222: npm ls ELSPROBLEMS).',
	);
	assert.equal(
		parseExact(carveOut, 'markdownlint-cli2 > js-yaml')[0],
		5,
		`markdownlint-cli2 must stay on js-yaml 5.x, got ${carveOut}`,
	);
});

test('lockfile resolves each nested carve-out to its declared version', () => {
	// The half that let #372 through CI: that PR's package.json and lockfile
	// disagreed, and nothing compared them.
	for (const [parent, block] of nested) {
		for (const [name, version] of Object.entries(block)) {
			const path = `node_modules/${parent}/node_modules/${name}`;
			const entry = lockPackages[path];
			assert.ok(
				entry,
				`lockfile has no ${path}, so the "${parent}" > "${name}" carve-out did not ` +
					'take effect. Run `npm install` and commit the lockfile.',
			);
			assert.equal(
				entry.version,
				version,
				`lockfile resolves ${path} to ${entry.version}, but package.json pins it to ` +
					`${version}. package.json and package-lock.json disagree -- run \`npm install\`.`,
			);
		}
	}
});

test('lockfile resolves each tree-wide pin everywhere it is not carved out', () => {
	// A tree-wide override applies at every depth, so checking only the hoisted
	// `node_modules/<name>` copy would miss drift in a package that npm placed
	// solely under a parent -- and would skip the check entirely, silently, for a
	// package that never hoists.
	for (const [name, version] of topLevel) {
		const entries = lockEntriesFor(name);
		assert.ok(
			entries.length > 0,
			`package.json pins "${name}" to ${version} but the lockfile resolves it nowhere. ` +
				'The pin is vestigial -- drop it, and its ADVISORY_FLOORS entry, once the ' +
				'dependency is genuinely gone.',
		);

		for (const { path, parent, version: resolved } of entries) {
			// A nested carve-out is a deliberate exemption from the tree-wide version;
			// the carve-out tests above own it.
			if (parent && overrides[parent]?.[name]) continue;

			assert.equal(
				resolved,
				version,
				`lockfile resolves ${path} to ${resolved}, but package.json pins "${name}" to ` +
					`${version}. Either package.json and package-lock.json disagree -- run ` +
					'`npm install` -- or this copy needs a deliberate nested carve-out.',
			);
		}
	}
});
