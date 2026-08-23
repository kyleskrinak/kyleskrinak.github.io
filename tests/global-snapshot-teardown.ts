import { assertNoSnapshotsCreated } from './snapshot-guard.mjs';

/**
 * Closes the `missing`-mode gap: any snapshot file that did not exist when the run
 * started was written from this host's rendering, so it is removed and the run fails.
 * See tests/snapshot-guard.ts for why mode alone cannot catch this.
 */
export default async function globalSnapshotTeardown() {
	assertNoSnapshotsCreated('tests');
}
