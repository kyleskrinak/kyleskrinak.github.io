/**
 * Per-run cap on timeout retries for check-links.js.
 *
 * Each retry costs up to another full navigation timeout. Without a cap, a run
 * with many hanging hosts doubles their cost and can outlast the linkwatch
 * job's timeout-minutes, which kills the job and loses the report. Once the
 * budget is spent, later timeouts get a single attempt.
 */

const assertCount = (name, value) => {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer, got ${value}`);
  }
};

/**
 * @param {{ total: number, perUrl: number }} limits - retries for the whole
 *   run, and the most any one URL may use
 */
export function createRetryBudget({ total, perUrl }) {
  assertCount('total', total);
  assertCount('perUrl', perUrl);
  let used = 0;

  return {
    get total() { return total; },
    get used() { return used; },
    get remaining() { return total - used; },
    /** Retries the next URL may use: its own limit, or what is left if less. */
    allowance() {
      return Math.min(perUrl, total - used);
    },
    /** Records the retries a URL actually used. Overspending is a caller bug. */
    record(retries) {
      assertCount('retries', retries);
      if (retries > total - used) {
        throw new RangeError(`recorded ${retries} retries with only ${total - used} left`);
      }
      used += retries;
    }
  };
}
