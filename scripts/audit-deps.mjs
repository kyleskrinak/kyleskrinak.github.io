#!/usr/bin/env node
/**
 * Supply-chain audit helper for npm dependency bumps.
 *
 * One command bundles the manual hygiene playbook used to inspect a dep change
 * before letting any of its code run. Designed to be invoked BEFORE `npm install`
 * for a dependency bump — it runs lockfile-only updates, inspects the would-be
 * delta, checks publish age, verifies signatures, and emits a GO/REVIEW/BLOCK
 * recommendation.
 *
 * Usage:
 *   audit:deps                            Audit pending package.json / lockfile changes
 *                                         in the working tree. Useful after editing
 *                                         package.json but before `npm install`.
 *   audit:deps --package <spec>           Treat <spec> (e.g. "dayjs@1.11.21") as the
 *   audit:deps -p <spec>                  target bump. Snapshots package.json + lockfile,
 *   audit:deps <spec>                     runs `npm install <spec> --package-lock-only --ignore-scripts`
 *                                         to compute the delta, then restores both files.
 *   audit:deps --base <ref>               Diff <ref>:package-lock.json against the
 *   audit:deps -b <ref>                   working-tree lockfile. Use for auditing a
 *                                         committed branch (e.g. a checked-out Renovate
 *                                         PR) where the working tree is clean:
 *                                           npm run audit:deps -- --base develop
 *                                           npm run audit:deps -- --base HEAD~1
 *                                         Mutually exclusive with --package.
 *   audit:deps --strict                   Fail-closed mode: escalates metadata
 *                                         unavailability and missing version timestamps
 *                                         from REVIEW (exit 0) to BLOCK (exit 1).
 *                                         Use when running in CI or any context where
 *                                         a silent skip of publish-age/revival checks
 *                                         is unacceptable.
 *   audit:deps --help | -h                Print this usage and exit.
 *
 * Exit codes:
 *   0   GO — clean signatures, no flags
 *   0   REVIEW — clean signatures, flags worth a human look (exit 0 keeps the script
 *       usable from non-blocking contexts; --strict escalates metadata failures to 1)
 *   1   BLOCK — signature failure, dormant-revival pattern, or (with --strict)
 *       metadata unavailability / missing timestamp
 *   2   Usage error (bad flag, missing --package value)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RECENT_THRESHOLD_DAYS = 7;
const DORMANT_REVIVAL_DAYS = 2 * 365.25;
const MS_PER_DAY = 86400000;

// Pure functions — exported for unit testing.

export function pathToName(path) {
	// Lockfile paths look like:
	//   node_modules/foo
	//   node_modules/@scope/foo
	//   node_modules/foo/node_modules/bar
	//   node_modules/foo/node_modules/@scope/bar
	// Workspace packages (e.g. "packages/foo") have no node_modules/ prefix.
	const marker = 'node_modules/';
	const idx = path.lastIndexOf(marker);
	if (idx < 0) return path;
	const tail = path.slice(idx + marker.length);
	const parts = tail.split('/');
	if (parts[0].startsWith('@') && parts.length >= 2) return `${parts[0]}/${parts[1]}`;
	return parts[0];
}

export function formatAge(isoDate) {
	if (!isoDate || Number.isNaN(new Date(isoDate).getTime())) return 'unknown';
	const ageMs = Date.now() - new Date(isoDate).getTime();
	const days = Math.floor(ageMs / MS_PER_DAY);
	if (days < 1) return 'today';
	if (days === 1) return '1 day';
	if (days < 30) return `${days} days`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months} mo`;
	const years = (days / 365.25).toFixed(1);
	return `${years} yr`;
}

export function extractPackages(lock) {
	if (!lock || !lock.packages) return new Map();
	const out = new Map();
	for (const [path, meta] of Object.entries(lock.packages)) {
		if (path === '' || !meta.version) continue;
		out.set(path, { version: meta.version, resolved: meta.resolved || '', integrity: meta.integrity || '' });
	}
	return out;
}

export function classifyDelta(before, after) {
	const added = [];
	const removed = [];
	const changed = [];
	const tampered = [];
	for (const [path, meta] of after) {
		if (!before.has(path)) {
			added.push({ path, ...meta });
		} else if (before.get(path).version !== meta.version) {
			// Version-bumped entries: resolved and integrity intentionally not compared
			// here — the old values belong to the old tarball. npm audit signatures
			// verifies the new version's tarball integrity downstream.
			changed.push({ path, from: before.get(path).version, to: meta.version });
		} else {
			const prev = before.get(path);
			if (prev.resolved !== meta.resolved || prev.integrity !== meta.integrity) {
				tampered.push({ path, version: meta.version, prevResolved: prev.resolved, resolved: meta.resolved, prevIntegrity: prev.integrity, integrity: meta.integrity });
			}
		}
	}
	for (const [path, meta] of before) {
		if (!after.has(path)) removed.push({ path, ...meta });
	}
	return { added, removed, changed, tampered };
}

export function detectDormantRevival(prevIsoDate, newIsoDate, thresholdDays = DORMANT_REVIVAL_DAYS) {
	if (!prevIsoDate || !newIsoDate) return null;
	const gapDays = (new Date(newIsoDate).getTime() - new Date(prevIsoDate).getTime()) / MS_PER_DAY;
	if (!Number.isFinite(gapDays) || gapDays < thresholdDays) return null;
	return { gapDays, gapYears: gapDays / 365.25 };
}

export function previousPublishedVersion(timeMap, targetVersion) {
	// For a NEWLY ADDED package there is no lockfile predecessor to diff against,
	// so derive one from the registry time map: the version published immediately
	// before `targetVersion`. Feeding its timestamp into detectDormantRevival lets
	// a long-dormant package that suddenly ships still trip the revival check.
	// `time --json` carries non-version keys (`created`, `modified`) that must be
	// skipped. Returns { version, iso } or null when no earlier release exists.
	if (!timeMap || !timeMap[targetVersion]) return null;
	const targetTime = new Date(timeMap[targetVersion]).getTime();
	let best = null;
	for (const [version, iso] of Object.entries(timeMap)) {
		if (version === 'created' || version === 'modified' || version === targetVersion) continue;
		const t = new Date(iso).getTime();
		if (Number.isNaN(t) || t >= targetTime) continue;
		if (best === null || t > best.time) best = { version, iso, time: t };
	}
	return best ? { version: best.version, iso: best.iso } : null;
}

// CLI-only helpers (subprocess-dependent, not tested).

function section(title) {
	console.log(`\n━━ ${title} ━━`);
}

function git(...gitArgs) {
	return execFileSync('git', gitArgs, { encoding: 'utf8' });
}

function tryGit(...gitArgs) {
	try { return git(...gitArgs); } catch { return ''; }
}

function npmViewTimeMap(name) {
	// Returns the full time map for a package: { created, modified, "1.0.0": iso, ... }.
	// Specific-version timestamps are the authoritative publish time for that version.
	try {
		const out = execFileSync('npm', ['view', name, 'time', '--json'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
			timeout: 30_000,
		});
		return JSON.parse(out);
	} catch {
		return null;
	}
}

function readHeadLockfile() {
	const out = tryGit('show', 'HEAD:package-lock.json');
	if (!out) return null;
	try {
		return JSON.parse(out);
	} catch {
		// A malformed committed lockfile shouldn't abort the audit — degrade to a
		// working-tree-only comparison (the Scope section already handles a null here).
		console.error('⚠️  HEAD package-lock.json is not valid JSON — comparing against working tree only.');
		return null;
	}
}

function readWorkingLockfile() {
	if (!existsSync('package-lock.json')) return null;
	try {
		return JSON.parse(readFileSync('package-lock.json', 'utf8'));
	} catch {
		// e.g. an interrupted `npm install` left a truncated lockfile. Return null and
		// let the caller print the human-readable abort rather than crash with a raw
		// SyntaxError stack trace (no uncaughtException handler exists on this path).
		console.error('❌ package-lock.json is not valid JSON (interrupted npm install?).');
		return null;
	}
}

// CLI entry — only runs when invoked directly, not when imported by tests.
if (fileURLToPath(import.meta.url) === process.argv[1]) {
	const args = process.argv.slice(2);
	let pkgSpec = null;
	let baseRef = null;
	let strict = false;

	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === '--help' || a === '-h') {
			const doc = readFileSync(new URL(import.meta.url), 'utf8').match(/\/\*\*[\s\S]*?\*\//)?.[0]
				?? '(usage block not found — see source comments)';
			console.log(doc);
			process.exit(0);
		} else if (a === '--strict') {
			strict = true;
		} else if (a === '--base' || a === '-b') {
			const next = args[i + 1];
			if (!next || next.startsWith('-')) {
				console.error(`Error: ${a} requires a ref argument (e.g. develop, HEAD~1)`);
				process.exit(2);
			}
			if (baseRef !== null) {
				console.error(`Error: multiple --base refs given ("${baseRef}" and "${next}"). Specify exactly one.`);
				process.exit(2);
			}
			baseRef = next;
			i++;
		} else if (a === '--package' || a === '-p') {
			const next = args[i + 1];
			if (!next || next.startsWith('-')) {
				console.error(`Error: ${a} requires a package spec argument (e.g. dayjs@1.11.21)`);
				process.exit(2);
			}
			if (pkgSpec !== null) {
				console.error(`Error: multiple package specs given ("${pkgSpec}" and "${next}"). Specify exactly one.`);
				process.exit(2);
			}
			pkgSpec = next;
			i++;
		} else if (!a.startsWith('-')) {
			if (pkgSpec !== null) {
				console.error(`Error: multiple package specs given ("${pkgSpec}" and "${a}"). Specify exactly one.`);
				process.exit(2);
			}
			pkgSpec = a;
		} else {
			console.error(`Error: unknown flag ${a}. Use --help for usage.`);
			process.exit(2);
		}
	}

	const flags = [];
	let blocked = false;
	// No-op by default. Replaced by a real restore() when --package mode snapshots
	// the working tree. Hoisted so the GO/REVIEW/BLOCK paths below can call it
	// explicitly before process.exit() — the `exit` event handler is only a
	// backstop because it can't change the already-locked-in exit code.
	let restore = () => {};

	console.log('🔍 Supply-chain audit');

	section('Scope');

	if (baseRef && pkgSpec) {
		console.error('Error: --base and --package are mutually exclusive.');
		process.exit(2);
	}

	let beforeLock;
	if (baseRef) {
		const raw = tryGit('show', `${baseRef}:package-lock.json`);
		if (!raw) {
			console.error(`❌ Cannot read package-lock.json at ref "${baseRef}". Verify the ref exists and the file is committed there.`);
			process.exit(1);
		}
		try { beforeLock = JSON.parse(raw); } catch {
			console.error(`⚠️  package-lock.json at ref "${baseRef}" is not valid JSON.`);
			process.exit(1);
		}
		console.log(`Base ref: ${baseRef} — comparing against working-tree package-lock.json.`);
	} else {
		beforeLock = readHeadLockfile();
		if (!beforeLock) {
			console.log('No HEAD package-lock.json available (new repo or uncommitted).');
			console.log('Comparing against working-tree lockfile only.');
		}
	}

	let dirty = '';
	if (pkgSpec) {
		console.log(`Target spec: ${pkgSpec}`);
		console.log('Running: npm install <spec> --package-lock-only --ignore-scripts (with snapshot/restore)');
		// `npm install --package-lock-only` mutates package.json AND package-lock.json.
		// `--no-save` would suppress writes but also make the call a no-op for lockfile
		// purposes. Snapshot both files, let npm mutate, restore on every exit path.
		if (!existsSync('package.json') || !existsSync('package-lock.json')) {
			console.error('❌ package.json and package-lock.json must both exist for --package mode.');
			process.exit(1);
		}
		const pkgBackup = readFileSync('package.json', 'utf8');
		const lockBackup = readFileSync('package-lock.json', 'utf8');
		let restored = false;
		restore = () => {
			if (restored) return;
			// Best-effort and non-throwing. Both writes are attempted independently
			// so a failure on one doesn't skip the other. Errors are surfaced via
			// stderr + process.exitCode so the failure is observable in CI, and the
			// caller (signal/exit handler) doesn't crash mid-teardown. `restored`
			// only seals when both writes succeed so an outer handler can still retry.
			const errs = [];
			try { writeFileSync('package.json', pkgBackup); } catch (e) { errs.push(e); }
			try { writeFileSync('package-lock.json', lockBackup); } catch (e) { errs.push(e); }
			if (errs.length > 0) {
				process.exitCode = 1;
				for (const e of errs) console.error('⚠️  restore failed:', e.message);
				return;
			}
			restored = true;
		};
		process.on('exit', restore);
		process.on('SIGHUP', () => { restore(); process.exit(129); });
		process.on('SIGINT', () => { restore(); process.exit(130); });
		process.on('SIGQUIT', () => { restore(); process.exit(131); });
		process.on('SIGTERM', () => { restore(); process.exit(143); });
		process.on('uncaughtException', (e) => { restore(); console.error(e); process.exit(1); });
		try {
			execFileSync('npm', ['install', pkgSpec, '--package-lock-only', '--ignore-scripts'], {
				stdio: ['ignore', 'ignore', 'inherit'],
				timeout: 120_000,
			});
		} catch {
			console.error('❌ npm install --package-lock-only failed.');
			restore();
			process.exit(1);
		}
	} else if (!baseRef) {
		// `git diff HEAD` covers both staged and unstaged changes; plain `git diff`
		// would miss staged-but-not-committed edits to package.json.
		dirty = tryGit('diff', '--name-only', 'HEAD', '--', 'package.json', 'package-lock.json').trim();
		if (!dirty) {
			console.log('No uncommitted changes to package.json / package-lock.json detected.');
			console.log('');
			console.log('If you are reviewing a committed branch (e.g. a Renovate PR),');
			console.log('pass --base to diff against a git ref:');
			console.log('  npm run audit:deps -- --base develop');
			console.log('  npm run audit:deps -- --base HEAD~1');
			console.log('');
			console.log('✅ Nothing to audit. Exiting cleanly.');
			process.exit(0);
		}
		console.log('Auditing pending working-tree changes to:');
		console.log(dirty.split('\n').map(l => `  ${l}`).join('\n'));
	}

	const afterLock = readWorkingLockfile();
	if (!afterLock) {
		console.error('❌ No package-lock.json found in working tree. Cannot audit.');
		restore();
		process.exit(1);
	}

	const before = extractPackages(beforeLock);
	const after = extractPackages(afterLock);

	const { added, removed, changed, tampered } = classifyDelta(before, after);

	section('Lockfile delta');
	console.log(`  Added:    ${added.length}`);
	console.log(`  Removed:  ${removed.length}`);
	console.log(`  Changed:  ${changed.length}`);
	if (tampered.length > 0) console.log(`  Tampered: ${tampered.length} 🛑`);

	if (added.length === 0 && removed.length === 0 && changed.length === 0 && tampered.length === 0) {
		const pkgJsonOnly = dirty && dirty.includes('package.json') && !dirty.includes('package-lock.json');
		if (pkgJsonOnly) {
			console.log('\n⚠️  package.json changed but package-lock.json was not regenerated.');
			console.log('Run `npm install` to update the lockfile, then re-run audit:deps.');
			console.log('Or use --package <spec> to audit a hypothetical bump without installing:');
			console.log('  npm run audit:deps -- --package <name>@<version>');
			flags.push('package.json edited but lockfile not yet regenerated — re-run after `npm install`');
			if (strict) blocked = true;
		} else {
			console.log('\n✅ No lockfile changes. Nothing to audit.');
			restore();
			// Bare process.exit() honors process.exitCode if restore() failed.
			process.exit();
		}
	}

	if (added.length > 0) {
		console.log('\nNew packages:');
		for (const p of added) {
			const name = pathToName(p.path);
			console.log(`  + ${name}@${p.version}`);
			// Flag pre-stable versions (0.x or any prerelease tag).
			if (/^0\./.test(p.version) || /-/.test(p.version)) {
				flags.push(`new pre-stable package: ${name}@${p.version}`);
				console.log(`    🚩 pre-stable version (0.x or prerelease) — treat as elevated risk`);
			}
		}
	}

	if (removed.length > 0) {
		console.log('\nRemoved packages:');
		for (const p of removed) {
			console.log(`  - ${pathToName(p.path)}@${p.version}`);
		}
	}

	if (changed.length > 0) {
		console.log('\nVersion changes:');
		for (const c of changed) {
			console.log(`  ~ ${pathToName(c.path)}: ${c.from} → ${c.to}`);
		}
	}

	if (tampered.length > 0) {
		console.log('\nSame-version metadata changes (possible lockfile tampering):');
		for (const t of tampered) {
			const name = pathToName(t.path);
			console.log(`  🛑 ${name}@${t.version}`);
			if (t.prevResolved !== t.resolved)
				console.log(`    resolved:  ${t.prevResolved || '(none)'} → ${t.resolved || '(none)'}`);
			if (t.prevIntegrity !== t.integrity)
				console.log(`    integrity: ${t.prevIntegrity || '(none)'} → ${t.integrity || '(none)'}`);
			flags.push(`lockfile tamper: ${name}@${t.version} — resolved/integrity changed without version bump`);
			blocked = true;
		}
	}

	section('Publish-age check');
	// Deduplicate by name@version — a package at multiple lockfile paths (npm nested
	// deduplication) should be checked once, not once per path.
	const _seenNV = new Set();
	const newOrChanged = [
		...added.map(p => ({ name: pathToName(p.path), version: p.version, prev: null })),
		...changed.map(c => ({ name: pathToName(c.path), version: c.to, prev: c.from })),
	].filter(p => _seenNV.has(`${p.name}@${p.version}`) ? false : !!_seenNV.add(`${p.name}@${p.version}`));

	const timeMapByName = new Map();
	for (const p of newOrChanged) {
		if (!timeMapByName.has(p.name)) timeMapByName.set(p.name, npmViewTimeMap(p.name));
		const timeMap = timeMapByName.get(p.name);
		if (!timeMap) {
			console.log(`  ⚠️  ${p.name}@${p.version} — metadata unavailable (registry error); age/revival checks skipped`);
			flags.push(`metadata unavailable: ${p.name}@${p.version} — publish-age and revival checks skipped`);
			if (strict) blocked = true;
			continue;
		}
		const newTime = timeMap[p.version] || '';
		if (!newTime) {
			flags.push(`no publish timestamp: ${p.name}@${p.version} — version absent from registry time map; revival check skipped`);
			if (strict) blocked = true;
		}
		const age = formatAge(newTime);
		const recent = newTime && (Date.now() - new Date(newTime).getTime()) < RECENT_THRESHOLD_DAYS * MS_PER_DAY;
		const marker = recent ? '🚩' : '  ';
		console.log(`  ${marker} ${p.name}@${p.version} — ${age}`);
		if (recent) flags.push(`recent publish (<${RECENT_THRESHOLD_DAYS}d): ${p.name}@${p.version} (${age})`);

		// Version bump: compare against the prior version named in the lockfile.
		// Newly added package: no lockfile predecessor, so derive the immediately
		// preceding published version from the registry time map. Either way a
		// long-dormant package that suddenly publishes trips the revival check.
		let prevLabel = p.prev;
		let prevIso = p.prev ? timeMap[p.prev] : null;
		if (!p.prev) {
			const prior = previousPublishedVersion(timeMap, p.version);
			if (prior) {
				prevLabel = prior.version;
				prevIso = prior.iso;
			}
		}
		if (prevIso) {
			const revival = detectDormantRevival(prevIso, newTime);
			if (revival) {
				const gapYears = revival.gapYears.toFixed(1);
				console.log(`    🛑 dormant-revival: ${gapYears}yr gap between ${prevLabel} and ${p.version}`);
				flags.push(`dormant-revival: ${p.name} ${prevLabel}→${p.version} (${gapYears}yr gap)`);
				blocked = true;
			}
		}
	}

	section('Signature verification');
	try {
		const sigOut = execFileSync('npm', ['audit', 'signatures'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
			maxBuffer: 10 * 1024 * 1024,
			timeout: 30_000,
		});
		// Print full output. `npm audit signatures` exits non-zero on bad signatures,
		// so reaching this branch means the registry verified everything that was
		// signed. CAVEAT: it exits 0 for UNSIGNED packages — see the workflow comment
		// in supply-chain-audit.yml for the assurance-gap discussion.
		console.log(sigOut.trim());
	} catch (err) {
		console.error('🛑 npm audit signatures failed:');
		console.error(err.stdout?.toString() || err.stderr?.toString() || err.message);
		flags.push('npm audit signatures exited non-zero');
		blocked = true;
	}

	section('Recommendation');
	// Explicit teardown before final exit so restore()'s process.exitCode (if it
	// failed) actually takes effect. The success branches use bare process.exit()
	// to honor it; the BLOCK branch keeps the explicit 1 (worst-case still 1).
	restore();
	if (blocked) {
		console.log('🛑 BLOCK — do not proceed without resolving:');
		for (const f of flags) console.log(`  • ${f}`);
		process.exit(1);
	} else if (flags.length > 0) {
		console.log('🟡 REVIEW — clean signatures, but worth a human look:');
		for (const f of flags) console.log(`  • ${f}`);
		console.log('\nProceed if you accept these. Exit 0.');
		process.exit();
	} else {
		console.log('✅ GO — signatures clean, no flagged transitives, no recent publishes.');
		process.exit();
	}
}
