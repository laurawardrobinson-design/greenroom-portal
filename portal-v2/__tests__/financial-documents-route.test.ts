import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  isWorkflowFeatureEnabled: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  getAuthUser: mocks.getAuthUser,
  authErrorResponse: (error: unknown) => {
    const err = error as { statusCode?: number; message?: string };
    return Response.json(
      { error: err?.message || "Internal server error" },
      { status: err?.statusCode || 500 }
    );
  },
}));

vi.mock("@/lib/services/feature-flags.service", () => ({
  isWorkflowFeatureEnabled: mocks.isWorkflowFeatureEnabled,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { GET } from "@/app/api/financial-documents/route";

function makeUser(role: AppUser["role"], vendorId: string | null = null): AppUser {
  return {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    role,
    active: true,
    avatarUrl: "",
    phone: "",
    title: "",
    vendorId,
    favoriteDrinks: "",
    favoriteSnacks: "",
    dietaryRestrictions: "",
    allergies: "",
    energyBoost: "",
    favoritePublixProduct: "",
    lunchPlace: "",
    preferredContact: "Email",
    onboardingCompleted: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("GET /api/financial-documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue(makeUser("Admin"));
    mocks.isWorkflowFeatureEnabled.mockResolvedValue(true);
  });

  it("returns 404 when documents-center v2 flag is disabled", async () => {
    mocks.isWorkflowFeatureEnabled.mockResolvedValue(false);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Not found");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("returns empty list for vendor accounts not linked to vendorId", async () => {
    mocks.getAuthUser.mockResolvedValue(makeUser("Vendor", null));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(mocks.createAdminClient).toHaveBeenCalledTimes(1);
  });
});
