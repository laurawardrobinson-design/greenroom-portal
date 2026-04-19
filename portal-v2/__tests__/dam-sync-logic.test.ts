import { describe, expect, it } from "vitest";
import {
  buildDamSyncIdempotencyKey,
  computeDamSyncBackoffSeconds,
  computeDamSyncNextAttemptAt,
} from "@/lib/services/dam-sync.service";

describe("dam-sync logic", () => {
  it("builds deterministic idempotency keys", () => {
    const keyA = buildDamSyncIdempotencyKey(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222"
    );
    const keyB = buildDamSyncIdempotencyKey(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222"
    );
    const keyC = buildDamSyncIdempotencyKey(
      "11111111-1111-4111-8111-111111111111",
      "33333333-3333-4333-8333-333333333333"
    );

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
  });

  it("uses exponential backoff with a hard cap", () => {
    expect(computeDamSyncBackoffSeconds(1)).toBe(15);
    expect(computeDamSyncBackoffSeconds(2)).toBe(30);
    expect(computeDamSyncBackoffSeconds(3)).toBe(60);
    expect(computeDamSyncBackoffSeconds(4)).toBe(120);
    expect(computeDamSyncBackoffSeconds(10)).toBe(900);
    expect(computeDamSyncBackoffSeconds(100)).toBe(900);
  });

  it("computes next-attempt timestamps in the future", () => {
    const now = Date.now();
    const next = new Date(computeDamSyncNextAttemptAt(2)).getTime();

    // 30s backoff for attempt 2, with small clock skew allowance.
    expect(next).toBeGreaterThan(now + 25_000);
    expect(next).toBeLessThan(now + 35_000);
  });
});
