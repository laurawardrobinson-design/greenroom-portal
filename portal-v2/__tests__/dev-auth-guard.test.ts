import { describe, it, expect, vi, beforeEach } from "vitest";
import { isDevAuthEnabled, isResetEnabled } from "@/lib/auth/dev-access";

describe("Dev auth endpoint guards", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects dev auth in production without server-side override", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEV_AUTH", "true");
    vi.stubEnv("DEV_AUTH_ALLOW_PRODUCTION", "false");
    expect(isDevAuthEnabled()).toBe(false);
  });

  it("allows dev auth in production only with server-side override", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEV_AUTH", "true");
    vi.stubEnv("DEV_AUTH_ALLOW_PRODUCTION", "true");
    expect(isDevAuthEnabled()).toBe(true);
  });

  it("rejects when NODE_ENV is development but DEV_AUTH toggle is false", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DEV_AUTH", "false");
    expect(isDevAuthEnabled()).toBe(false);
  });

  it("allows when NODE_ENV is development and DEV_AUTH is true", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DEV_AUTH", "true");
    expect(isDevAuthEnabled()).toBe(true);
  });

  it("allows reset in local development by default", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_RESET_ENABLED", "false");
    expect(isResetEnabled()).toBe(true);
  });

  it("rejects reset in production without server-side override", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_RESET_ENABLED", "true");
    vi.stubEnv("RESET_ALLOW_PRODUCTION", "false");
    expect(isResetEnabled()).toBe(false);
  });

  it("allows reset in production with both toggles", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_RESET_ENABLED", "true");
    vi.stubEnv("RESET_ALLOW_PRODUCTION", "true");
    expect(isResetEnabled()).toBe(true);
  });
});
