/**
 * Pure mode/argv logic for the baseline guard, kept in plain JS so
 * `node --test tests/unit/*.test.mjs` can cover it without a TS-capable runner.
 *
 * This parser has been the source of repeated bypasses (`-uall`, `-xu`, duplicate
 * flags), which is exactly why it is unit-tested rather than only reasoned about.
 * It is a fast path, not the authority -- tests/global-snapshot-guard.ts reads
 * Playwright's own parsed mode, and tests/global-snapshot-teardown.ts measures the
 * files a run actually created.
 */

/**
 * Modes that overwrite baselines which already exist -- the ones worth refusing.
 *
 * Deliberately excludes 'missing', Playwright's default for every ordinary run: it
 * only fills in snapshots that don't exist yet, so refusing it by mode would block
 * all local testing. The files it does create are caught after the run instead.
 * A bare `-u` resolves to 'changed', so explicit update paths are all covered.
 */
export const OVERWRITING_MODES = ['all', 'changed'];

/** @param {string} mode */
export const overwritesBaselines = (mode) => OVERWRITING_MODES.includes(mode);

// Short flags taking a value: -c <config>, -g <grep>, -j <workers>. In a cluster the
// first such flag consumes the remainder, so `-gu` is grep="u", not -u.
const VALUE_CONSUMING = 'cgj';

/**
 * Whether argv asks for a run that would overwrite existing baselines.
 * @param {string[]} argv
 * @returns {boolean}
 */
export const argvRequestsSnapshotWrites = (argv) => {
	/** @type {string[]} */
	const modes = [];

	/** @param {number} index */
	const modeAfter = (index) => {
		const next = argv[index + 1];
		return next !== undefined && !next.startsWith('-') ? next : 'changed';
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];

		if (arg.startsWith('--update-snapshots=')) {
			modes.push(arg.slice('--update-snapshots='.length));
			continue;
		}
		if (arg === '--update-snapshots') {
			modes.push(modeAfter(i));
			continue;
		}
		// Short-flag cluster: -u, -uall, -xu, -xuall all reach --update-snapshots.
		if (/^-[^-]/.test(arg)) {
			const chars = arg.slice(1);
			for (let k = 0; k < chars.length; k++) {
				const char = chars[k];
				if (char === 'u') {
					const attached = chars.slice(k + 1);
					modes.push(attached !== '' ? attached : modeAfter(i));
					break;
				}
				if (VALUE_CONSUMING.includes(char)) break;
			}
		}
	}

	// Every occurrence counts, not just the first: Playwright takes the last one, so a
	// leading `--update-snapshots=none` must not mask a later `--update-snapshots=all`.
	return modes.some(overwritesBaselines);
};
