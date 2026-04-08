import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  requireRole: vi.fn(),
  requireVendorOwnership: vi.fn(),
  isWorkflowFeatureEnabled: vi.fn(),
  createInvoice: vi.fn(),
  getInvoiceForCampaignVendor: vi.fn(),
  approveInvoice: vi.fn(),
  transitionVendorStatus: vi.fn(),
  createAdminClient: vi.fn(),
  recordWorkflowAuditEvent: vi.fn(),
  getRequestIpAddress: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  getAuthUser: mocks.getAuthUser,
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

vi.mock("@/lib/services/feature-flags.service", () => ({
  isWorkflowFeatureEnabled: mocks.isWorkflowFeatureEnabled,
}));

vi.mock("@/lib/services/invoice.service", () => ({
  createInvoice: mocks.createInvoice,
  getInvoiceForCampaignVendor: mocks.getInvoiceForCampaignVendor,
  approveInvoice: mocks.approveInvoice,
}));

vi.mock("@/lib/services/campaign-vendors.service", () => ({
  transitionVendorStatus: mocks.transitionVendorStatus,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/services/workflow-audit.service", () => ({
  recordWorkflowAuditEvent: mocks.recordWorkflowAuditEvent,
  getRequestIpAddress: mocks.getRequestIpAddress,
}));

import { PATCH } from "@/app/api/invoices/route";

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
    vendorId: null,
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

function setAdminClientRows(options: {
  invoiceRow?: { id: string; campaign_vendor_id: string; parse_status?: string } | null;
  assignmentRow?: { estimate_total: number; invoice_total: number } | null;
}) {
  const from = vi.fn((table: string) => {
    if (table === "vendor_invoices") {
      const row =
        options.invoiceRow === undefined
          ? null
          : options.invoiceRow
            ? {
                ...options.invoiceRow,
                parse_status: options.invoiceRow.parse_status || "completed",
              }
            : null;
      const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    }

    if (table === "campaign_vendors") {
      const maybeSingle = vi
        .fn()
        .mockResolvedValue({ data: options.assignmentRow || null, error: null });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    }

    throw new Error(`Unexpected table lookup in test: ${table}`);
  });
  mocks.createAdminClient.mockReturnValue({ from });
}

describe("PATCH /api/invoices auth hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue(makeUser("Producer"));
    mocks.isWorkflowFeatureEnabled.mockImplementation(
      async (flag: string) => flag === "workflow_approval_unification_v2"
    );
    mocks.requireRole.mockResolvedValue(undefined);
    mocks.approveInvoice.mockResolvedValue(undefined);
    mocks.transitionVendorStatus.mockResolvedValue(undefined);
    mocks.recordWorkflowAuditEvent.mockResolvedValue(undefined);
    mocks.getRequestIpAddress.mockReturnValue("127.0.0.1");
    setAdminClientRows({ invoiceRow: null });
  });

  it("rejects invalid approverType", async () => {
    const request = new Request("http://localhost/api/invoices", {
      method: "PATCH",
      body: JSON.stringify({
        invoiceId: "inv-1",
        campaignVendorId: "cv-1",
        approverType: "invalid",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("approverType");
    expect(mocks.approveInvoice).not.toHaveBeenCalled();
  });

  it("requires campaignVendorId when hardening flag is enabled", async () => {
    mocks.isWorkflowFeatureEnabled.mockImplementation(async (flag: string) => {
      return (
        flag === "workflow_authz_hardening_v2" ||
        flag === "workflow_approval_unification_v2"
      );
    });
    setAdminClientRows({
      invoiceRow: { id: "inv-1", campaign_vendor_id: "cv-1" },
    });
    const request = new Request("http://localhost/api/invoices", {
      method: "PATCH",
      body: JSON.stringify({
        invoiceId: "inv-1",
        approverType: "producer",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
    expect(mocks.approveInvoice).not.toHaveBeenCalled();
  });

  it("blocks approval when invoiceId does not match campaignVendorId", async () => {
    mocks.isWorkflowFeatureEnabled.mockImplementation(async (flag: string) => {
      return (
        flag === "workflow_authz_hardening_v2" ||
        flag === "workflow_approval_unification_v2"
      );
    });
    setAdminClientRows({ invoiceRow: { id: "inv-1", campaign_vendor_id: "cv-other" } });

    const request = new Request("http://localhost/api/invoices", {
      method: "PATCH",
      body: JSON.stringify({
        invoiceId: "inv-1",
        campaignVendorId: "cv-1",
        approverType: "producer",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
    expect(mocks.requireRole).toHaveBeenCalledWith(["Admin", "Producer"]);
    expect(mocks.approveInvoice).not.toHaveBeenCalled();
  });

  it("approves and transitions when validation passes", async () => {
    mocks.isWorkflowFeatureEnabled.mockImplementation(async (flag: string) => {
      return (
        flag === "workflow_authz_hardening_v2" ||
        flag === "workflow_approval_unification_v2"
      );
    });
    mocks.getAuthUser.mockResolvedValue(makeUser("Admin"));
    setAdminClientRows({ invoiceRow: { id: "inv-1", campaign_vendor_id: "cv-1" } });

    const request = new Request("http://localhost/api/invoices", {
      method: "PATCH",
      body: JSON.stringify({
        invoiceId: "inv-1",
        campaignVendorId: "cv-1",
        approverType: "hop",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.requireRole).toHaveBeenCalledWith(["Admin"]);
    expect(mocks.approveInvoice).toHaveBeenCalledWith({
      invoiceId: "inv-1",
      approverType: "hop",
      userId: "user-1",
    });
    expect(mocks.transitionVendorStatus).toHaveBeenCalledWith(
      "cv-1",
      "Invoice Approved"
    );
  });

  it("blocks producer approval until invoice parsing is completed", async () => {
    mocks.isWorkflowFeatureEnabled.mockImplementation(async (flag: string) => {
      return (
        flag === "workflow_invoice_cap_enforcement_v2" ||
        flag === "workflow_approval_unification_v2"
      );
    });
    setAdminClientRows({
      invoiceRow: {
        id: "inv-1",
        campaign_vendor_id: "cv-1",
        parse_status: "processing",
      },
    });

    const request = new Request("http://localhost/api/invoices", {
      method: "PATCH",
      body: JSON.stringify({
        invoiceId: "inv-1",
        approverType: "producer",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request);

    expect(response.status).toBe(409);
    expect(mocks.approveInvoice).not.toHaveBeenCalled();
  });

  it("blocks producer approval when invoice total exceeds estimate total", async () => {
    mocks.isWorkflowFeatureEnabled.mockImplementation(async (flag: string) => {
      return (
        flag === "workflow_invoice_cap_enforcement_v2" ||
        flag === "workflow_approval_unification_v2"
      );
    });
    setAdminClientRows({
      invoiceRow: {
        id: "inv-1",
        campaign_vendor_id: "cv-1",
        parse_status: "completed",
      },
      assignmentRow: {
        estimate_total: 1000,
        invoice_total: 1200,
      },
    });

    const request = new Request("http://localhost/api/invoices", {
      method: "PATCH",
      body: JSON.stringify({
        invoiceId: "inv-1",
        approverType: "producer",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
    expect(mocks.approveInvoice).not.toHaveBeenCalled();
  });

  it("logs parse-not-ready in shadow mode without blocking approval", async () => {
    mocks.isWorkflowFeatureEnabled.mockImplementation(async (flag: string) => {
      return (
        flag === "workflow_invoice_cap_shadow_v2" ||
        flag === "workflow_approval_unification_v2"
      );
    });
    setAdminClientRows({
      invoiceRow: {
        id: "inv-1",
        campaign_vendor_id: "cv-1",
        parse_status: "processing",
      },
    });

    const request = new Request("http://localhost/api/invoices", {
      method: "PATCH",
      body: JSON.stringify({
        invoiceId: "inv-1",
        approverType: "producer",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request);

    expect(response.status).toBe(200);
    expect(mocks.recordWorkflowAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "invoice_parse_not_ready_detected",
      })
    );
    expect(mocks.approveInvoice).toHaveBeenCalled();
  });

  it("falls back to legacy status transition when approval unification is disabled", async () => {
    mocks.getAuthUser.mockResolvedValue(makeUser("Admin"));
    mocks.isWorkflowFeatureEnabled.mockResolvedValue(false);

    const request = new Request("http://localhost/api/invoices", {
      method: "PATCH",
      body: JSON.stringify({
        invoiceId: "inv-1",
        campaignVendorId: "cv-1",
        approverType: "hop",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.legacyMode).toBe(true);
    expect(mocks.requireRole).toHaveBeenCalledWith(["Admin"]);
    expect(mocks.transitionVendorStatus).toHaveBeenCalledWith(
      "cv-1",
      "Invoice Approved"
    );
    expect(mocks.approveInvoice).not.toHaveBeenCalled();
  });
});
