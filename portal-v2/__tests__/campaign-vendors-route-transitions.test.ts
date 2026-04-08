import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  requireCampaignVendorAccess: vi.fn(),
  requireRole: vi.fn(),
  requireVendorOwnership: vi.fn(),
  getCampaignVendor: vi.fn(),
  transitionVendorStatus: vi.fn(),
  submitEstimate: vi.fn(),
  getEstimateItems: vi.fn(),
  removeVendorFromCampaign: vi.fn(),
  isWorkflowFeatureEnabled: vi.fn(),
  recordWorkflowAuditEvent: vi.fn(),
  getRequestIpAddress: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  getAuthUser: mocks.getAuthUser,
  requireCampaignVendorAccess: mocks.requireCampaignVendorAccess,
  requireRole: mocks.requireRole,
  requireVendorOwnership: mocks.requireVendorOwnership,
  authErrorResponse: (error: unknown) => {
    const err = error as { statusCode?: number; message?: string };
    return Response.json(
      { error: err?.message || "Internal server error" },
      { status: err?.statusCode || 500 }
    );
  },
}));

vi.mock("@/lib/services/campaign-vendors.service", () => ({
  getCampaignVendor: mocks.getCampaignVendor,
  transitionVendorStatus: mocks.transitionVendorStatus,
  submitEstimate: mocks.submitEstimate,
  getEstimateItems: mocks.getEstimateItems,
  removeVendorFromCampaign: mocks.removeVendorFromCampaign,
}));

vi.mock("@/lib/services/feature-flags.service", () => ({
  isWorkflowFeatureEnabled: mocks.isWorkflowFeatureEnabled,
}));

vi.mock("@/lib/services/workflow-audit.service", () => ({
  recordWorkflowAuditEvent: mocks.recordWorkflowAuditEvent,
  getRequestIpAddress: mocks.getRequestIpAddress,
}));

import { PATCH } from "@/app/api/campaign-vendors/[id]/route";

function makeUser(role: AppUser["role"]): AppUser {
  return {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    role,
    active: true,
    avatarUrl: "",
    phone: "",
    title: "",
    vendorId: role === "Vendor" ? "vendor-1" : null,
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

function makeTransitionRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/campaign-vendors/cv-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/campaign-vendors/[id] transition hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue(makeUser("Producer"));
    mocks.requireCampaignVendorAccess.mockResolvedValue(undefined);
    mocks.requireRole.mockResolvedValue(undefined);
    mocks.requireVendorOwnership.mockResolvedValue(undefined);
    mocks.transitionVendorStatus.mockResolvedValue({ id: "cv-1" });
    mocks.recordWorkflowAuditEvent.mockResolvedValue(undefined);
    mocks.getRequestIpAddress.mockReturnValue("127.0.0.1");
    mocks.isWorkflowFeatureEnabled.mockImplementation(async (flag: string) => {
      if (flag === "workflow_authz_hardening_v2") return true;
      return false;
    });
  });

  it("rejects invalid targetStatus before service call", async () => {
    const response = await PATCH(
      makeTransitionRequest({
        action: "transition",
        targetStatus: "Not A Real Status",
      }),
      { params: Promise.resolve({ id: "cv-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("targetStatus");
    expect(mocks.transitionVendorStatus).not.toHaveBeenCalled();
  });

  it("rejects non-object payloads", async () => {
    const response = await PATCH(
      makeTransitionRequest({
        action: "transition",
        targetStatus: "PO Uploaded",
        payload: "bad",
      }),
      { params: Promise.resolve({ id: "cv-1" }) }
    );

    expect(response.status).toBe(400);
    expect(mocks.transitionVendorStatus).not.toHaveBeenCalled();
  });

  it("maps transition state-machine failures to safe conflict messages", async () => {
    mocks.transitionVendorStatus.mockRejectedValue(
      new Error('Cannot transition from "Shoot Complete" to "PO Uploaded"')
    );

    const response = await PATCH(
      makeTransitionRequest({
        action: "transition",
        targetStatus: "PO Uploaded",
        payload: { poFileUrl: "/po/test.pdf" },
      }),
      { params: Promise.resolve({ id: "cv-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("not allowed");
  });

  it("applies campaign-vendor access guard when authz hardening is enabled", async () => {
    await PATCH(
      makeTransitionRequest({
        action: "transition",
        targetStatus: "Estimate Approved",
      }),
      { params: Promise.resolve({ id: "cv-1" }) }
    );

    expect(mocks.requireCampaignVendorAccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1" }),
      "cv-1"
    );
  });
});
