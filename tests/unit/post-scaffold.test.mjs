import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { todayEasternDate } from '../../scripts/lib/post-scaffold.mjs';

describe('todayEasternDate', () => {
  it('returns the Eastern day when UTC has already reached the next day (EST)', () => {
    assert.equal(todayEasternDate(new Date('2026-11-22T01:30:00Z')), '2026-11-21');
  });

  it('rolls over at Eastern midnight, 05:00 UTC, under EST', () => {
    assert.equal(todayEasternDate(new Date('2026-11-22T04:59:59Z')), '2026-11-21');
    assert.equal(todayEasternDate(new Date('2026-11-22T05:00:00Z')), '2026-11-22');
  });

  it('rolls over at Eastern midnight, 04:00 UTC, under EDT', () => {
    assert.equal(todayEasternDate(new Date('2026-07-04T03:59:59Z')), '2026-07-03');
    assert.equal(todayEasternDate(new Date('2026-07-04T04:00:00Z')), '2026-07-04');
  });

  it('zero-pads the month and day', () => {
    assert.equal(todayEasternDate(new Date('2026-01-05T17:00:00Z')), '2026-01-05');
  });
});
