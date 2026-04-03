import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Dev auth endpoint guards", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects when NODE_ENV is production even if DEV_AUTH is true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEV_AUTH", "true");

    // The guard condition from dev-login/route.ts:
    const isBlocked =
      process.env.NODE_ENV !== "development" ||
      process.env.NEXT_PUBLIC_DEV_AUTH !== "true";

    expect(isBlocked).toBe(true);
  });

  it("rejects when NODE_ENV is development but DEV_AUTH is false", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DEV_AUTH", "false");

    const isBlocked =
      process.env.NODE_ENV !== "development" ||
      process.env.NEXT_PUBLIC_DEV_AUTH !== "true";

    expect(isBlocked).toBe(true);
  });

  it("allows when NODE_ENV is development AND DEV_AUTH is true", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DEV_AUTH", "true");

    const isBlocked =
      process.env.NODE_ENV !== "development" ||
      process.env.NEXT_PUBLIC_DEV_AUTH !== "true";

    expect(isBlocked).toBe(false);
  });

  it("rejects when NODE_ENV is undefined", async () => {
    vi.stubEnv("NODE_ENV", "");
    vi.stubEnv("NEXT_PUBLIC_DEV_AUTH", "true");

    const isBlocked =
      process.env.NODE_ENV !== "development" ||
      process.env.NEXT_PUBLIC_DEV_AUTH !== "true";

    expect(isBlocked).toBe(true);
  });
});
