import type { FullConfig } from '@playwright/test';
import { assertSnapshotWritesAllowed, overwritesBaselines, recordExistingSnapshots } from './snapshot-guard';

/**
 * Refuse an explicit overwrite, and record the snapshot tree so globalTeardown can tell
 * what this run created. `config.updateSnapshots` is Playwright's own parsed value, so
 * no command-line spelling can evade it.
 *
 * This runs after the webServer starts, so a refusal costs a build first. That is the
 * accepted price of not second-guessing argv -- see tests/snapshot-guard.ts.
 */
export default async function globalSnapshotGuard(config: FullConfig) {
	assertSnapshotWritesAllowed(overwritesBaselines(config.updateSnapshots));
	recordExistingSnapshots('tests');
}
