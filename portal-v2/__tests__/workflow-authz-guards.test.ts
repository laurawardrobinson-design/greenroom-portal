import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { AuthError, requireCampaignVendorAccess } from "@/lib/auth/guards";

const baseUser: AppUser = {
  id: "user-1",
  email: "user@example.com",
  name: "User",
  role: "Vendor",
  active: true,
  avatarUrl: "",
  phone: "",
  title: "",
  vendorId: "vendor-1",
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

function stubCampaignVendorLookup(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  mocks.from.mockReturnValue({ select });
}

describe("requireCampaignVendorAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAdminClient.mockReturnValue({ from: mocks.from });
  });

  it("allows a vendor to access their own assignment", async () => {
    stubCampaignVendorLookup({
      id: "cv-1",
      campaign_id: "campaign-1",
      vendor_id: "vendor-1",
    });

    const result = await requireCampaignVendorAccess(baseUser, "cv-1");

    expect(result.id).toBe("cv-1");
    expect(result.vendor_id).toBe("vendor-1");
  });

  it("blocks vendor access to another vendor assignment", async () => {
    stubCampaignVendorLookup({
      id: "cv-2",
      campaign_id: "campaign-1",
      vendor_id: "vendor-2",
    });

    await expect(
      requireCampaignVendorAccess(baseUser, "cv-2")
    ).rejects.toMatchObject<AuthError>({
      statusCode: 403,
      message: "Not your assignment",
    });
  });

  it("returns not found when campaign_vendor does not exist", async () => {
    stubCampaignVendorLookup(null, null);

    await expect(
      requireCampaignVendorAccess(baseUser, "cv-missing")
    ).rejects.toMatchObject<AuthError>({
      statusCode: 404,
      message: "Not found",
    });
  });

  it("allows admin access to any assignment", async () => {
    stubCampaignVendorLookup({
      id: "cv-3",
      campaign_id: "campaign-2",
      vendor_id: "vendor-9",
    });

    const adminUser: AppUser = { ...baseUser, role: "Admin", vendorId: null };
    const result = await requireCampaignVendorAccess(adminUser, "cv-3");

    expect(result.id).toBe("cv-3");
  });
});
