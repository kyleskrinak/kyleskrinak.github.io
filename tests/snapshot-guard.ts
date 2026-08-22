/**
 * Shared refusal for snapshot-writing runs on a host that doesn't match CI.
 *
 * Committed baselines are compared against CI's Ubuntu rendering, whose font stack
 * renders slightly taller than macOS, so snapshots written anywhere else overwrite
 * committed files with pixels CI will reject. Docker and CI are both Linux, so the
 * sanctioned baseline paths are unaffected.
 */
export const ALLOW_NATIVE_BASELINE = () => process.env.ALLOW_NATIVE_BASELINE === '1';

/**
 * Modes that overwrite baselines which already exist -- the ones worth refusing.
 *
 * Deliberately excludes 'missing', which is Playwright's *default* for every ordinary
 * run: it only fills in snapshots that don't exist yet and can never overwrite a
 * committed PNG, so refusing it would block all local testing to no benefit. A bare
 * `-u` resolves to 'changed', so the explicit update paths are all covered.
 */
const OVERWRITING_MODES = ['all', 'changed'];

export const overwritesBaselines = (mode: string) => OVERWRITING_MODES.includes(mode);

export const assertSnapshotWritesAllowed = (writesSnapshots: boolean) => {
	if (!writesSnapshots || process.platform === 'linux' || ALLOW_NATIVE_BASELINE()) return;

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

/**
 * Best-effort argv scan, used only to refuse *before* the webServer build starts.
 * Playwright's own parsed value is the authority (see globalSetup in
 * playwright.config.ts); this exists purely so the common cases fail in a second
 * rather than after a full site build. A miss here is not a hole -- globalSetup
 * still catches it -- but a false positive would block a legitimate run, so flags
 * that swallow the rest of a cluster as their value are respected.
 */
export const argvRequestsSnapshotWrites = (argv: string[]): boolean => {
	// Short flags taking a value: -c <config>, -g <grep>, -j <workers>. In a cluster
	// the first such flag consumes the remainder, so `-gu` is grep="u", not -u.
	const VALUE_CONSUMING = 'cgj';
	const modes: string[] = [];

	const modeAfter = (index: number) => {
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
