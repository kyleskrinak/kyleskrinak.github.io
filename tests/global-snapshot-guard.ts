import type { FullConfig } from '@playwright/test';
import { assertSnapshotWritesAllowed, overwritesBaselines } from './snapshot-guard';

/**
 * Authoritative half of the baseline guard: `config.updateSnapshots` is Playwright's
 * own parsed value, so it cannot be evaded by an argv spelling the scan in
 * playwright.config.ts doesn't anticipate (`-uall`, `-xu`, a future alias).
 *
 * Runs after the webServer starts, which is why the argv fast path exists -- but this
 * is the check that actually has to be right.
 */
export default async function globalSnapshotGuard(config: FullConfig) {
	assertSnapshotWritesAllowed(overwritesBaselines(config.updateSnapshots));
}
