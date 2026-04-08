import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import {
  clearWorkflowFeatureFlagCache,
  isWorkflowFeatureEnabled,
} from "@/lib/services/feature-flags.service";

function stubFlagLookup(
  data: unknown,
  error: { message: string } | null = null
) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  mocks.from.mockReturnValue({ select });
}

describe("isWorkflowFeatureEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    clearWorkflowFeatureFlagCache();
    mocks.createAdminClient.mockReturnValue({ from: mocks.from });
  });

  it("uses env override when enabled", async () => {
    vi.stubEnv("FEATURE_FLAG_WORKFLOW_AUTHZ_HARDENING_V2", "true");

    const result = await isWorkflowFeatureEnabled("workflow_authz_hardening_v2");

    expect(result).toBe(true);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("uses env override when disabled", async () => {
    vi.stubEnv("FEATURE_FLAG_WORKFLOW_AUTHZ_HARDENING_V2", "false");

    const result = await isWorkflowFeatureEnabled("workflow_authz_hardening_v2");

    expect(result).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("falls back to default when DB lookup errors", async () => {
    stubFlagLookup(null, { message: "db unavailable" });

    const result = await isWorkflowFeatureEnabled(
      "workflow_authz_hardening_v2",
      { defaultValue: false, bypassCache: true }
    );

    expect(result).toBe(false);
  });

  it("returns DB value when no env override is set", async () => {
    stubFlagLookup({ enabled: true }, null);

    const result = await isWorkflowFeatureEnabled(
      "workflow_authz_hardening_v2",
      { bypassCache: true }
    );

    expect(result).toBe(true);
  });
});
