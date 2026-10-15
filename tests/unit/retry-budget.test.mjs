import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createRetryBudget } from "../../scripts/lib/retry-budget.js";

describe("createRetryBudget", () => {
  it("allows each URL its own limit while the budget lasts", () => {
    const budget = createRetryBudget({ total: 10, perUrl: 1 });
    assert.equal(budget.allowance(), 1);
    budget.record(0); // URL that did not time out
    assert.equal(budget.allowance(), 1);
    assert.equal(budget.remaining, 10);
  });

  it("runs out after total retries and then allows none", () => {
    const budget = createRetryBudget({ total: 3, perUrl: 1 });
    for (let i = 0; i < 3; i++) {
      assert.equal(budget.allowance(), 1, `URL ${i + 1}`);
      budget.record(1);
    }
    assert.equal(budget.remaining, 0);
    assert.equal(budget.allowance(), 0);
    budget.record(0); // a URL on a spent budget makes one attempt
    assert.equal(budget.used, 3);
  });

  it("caps the allowance at what is left when perUrl exceeds it", () => {
    const budget = createRetryBudget({ total: 3, perUrl: 2 });
    budget.record(2);
    assert.equal(budget.allowance(), 1);
  });

  it("allows nothing with a zero total", () => {
    assert.equal(createRetryBudget({ total: 0, perUrl: 1 }).allowance(), 0);
  });

  it("throws when a caller records more than is left", () => {
    const budget = createRetryBudget({ total: 1, perUrl: 1 });
    budget.record(1);
    assert.throws(() => budget.record(1), RangeError);
  });

  it("rejects invalid limits and counts", () => {
    for (const bad of [-1, 1.5, NaN, undefined, "1"]) {
      assert.throws(() => createRetryBudget({ total: bad, perUrl: 1 }), RangeError, `total ${bad}`);
      assert.throws(() => createRetryBudget({ total: 1, perUrl: bad }), RangeError, `perUrl ${bad}`);
      assert.throws(() => createRetryBudget({ total: 1, perUrl: 1 }).record(bad), RangeError, `record ${bad}`);
    }
  });
});
