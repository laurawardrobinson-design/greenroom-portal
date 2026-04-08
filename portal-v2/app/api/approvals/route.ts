import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listBudgetRequests } from "@/lib/services/budget.service";
import { listPendingCrewPayments } from "@/lib/services/crew-payments.service";
import { createAdminClient } from "@/lib/supabase/admin";

type InvoiceApprovalRow = {
  id: string;
  campaign_id: string;
  estimate_total: number | string | null;
  invoice_total: number | string | null;
  status: string;
  updated_at: string;
  vendors:
    | { company_name: string | null }
    | Array<{ company_name: string | null }>
    | null;
  campaigns:
    | { name: string | null; wf_number: string | null }
    | Array<{ name: string | null; wf_number: string | null }>
    | null;
};

type CrewBookingApprovalRow = {
  id: string;
  campaign_id: string;
  role: string | null;
  day_rate: number | string | null;
  classification: string | null;
  created_at: string;
  vendors:
    | { company_name: string | null; contact_name: string | null }
    | Array<{ company_name: string | null; contact_name: string | null }>
    | null;
  crew_person: { name: string | null } | Array<{ name: string | null }> | null;
  campaigns:
    | { name: string | null; wf_number: string | null }
    | Array<{ name: string | null; wf_number: string | null }>
    | null;
  crew_booking_dates: Array<{ id: string }> | null;
};

// GET /api/approvals — pending + resolved items for HOP
export async function GET() {
  try {
    await requireRole(["Admin"]);
    const db = createAdminClient();

    const [
      allRequests,
      pendingInvoicesResult,
      completedInvoicesResult,
      pendingCrewBookingsResult,
      pendingCrewPayments,
    ] = await Promise.all([
      // All budget requests (pending + resolved)
      listBudgetRequests(),
      // Pending invoice approvals (Invoice Pre-Approved -> needs HOP approval)
      db
        .from("campaign_vendors")
        .select(
          "id, campaign_id, estimate_total, invoice_total, status, updated_at, vendors(company_name), campaigns(name, wf_number)"
        )
        .eq("status", "Invoice Pre-Approved")
        .order("updated_at", { ascending: false }),
      // Resolved invoice approvals (Invoice Approved or Paid)
      db
        .from("campaign_vendors")
        .select(
          "id, campaign_id, estimate_total, invoice_total, status, updated_at, vendors(company_name), campaigns(name, wf_number)"
        )
        .in("status", ["Invoice Approved", "Paid"])
        .order("updated_at", { ascending: false })
        .limit(50),
      // Pending crew booking approvals (rate exceeds standard -> needs HOP)
      db
        .from("crew_bookings")
        .select(
          "id, campaign_id, role, day_rate, classification, created_at, vendors(company_name, contact_name), crew_person:users!crew_bookings_user_id_fkey(name), campaigns(name, wf_number), crew_booking_dates(id)"
        )
        .eq("status", "Pending Approval")
        .order("created_at", { ascending: false }),
      // Pending crew payment approvals (days confirmed -> awaiting HOP to approve for paymaster)
      listPendingCrewPayments(),
    ]);

    if (pendingInvoicesResult.error) {
      throw pendingInvoicesResult.error;
    }

    if (completedInvoicesResult.error) {
      throw completedInvoicesResult.error;
    }

    if (pendingCrewBookingsResult.error) {
      throw pendingCrewBookingsResult.error;
    }

    const budgetRequests = allRequests.filter((r) => r.status === "Pending");
    const resolvedRequests = allRequests.filter((r) => r.status !== "Pending");
    const pendingInvoices = pendingInvoicesResult.data || [];
    const completedInvoices = completedInvoicesResult.data || [];
    const pendingCrewBookings = pendingCrewBookingsResult.data || [];

    function firstRelation<T>(value: T | T[] | null | undefined): T | null {
      if (!value) return null;
      return Array.isArray(value) ? (value[0] ?? null) : value;
    }

    function mapInvoice(row: InvoiceApprovalRow) {
      const vendor = firstRelation(row.vendors);
      const campaign = firstRelation(row.campaigns);
      return {
        id: row.id,
        campaignId: row.campaign_id,
        vendorName: vendor?.company_name || "Unknown",
        campaignName: campaign?.name || "Unknown",
        wfNumber: campaign?.wf_number || "",
        estimateTotal: Number(row.estimate_total),
        invoiceTotal: Number(row.invoice_total),
        status: row.status,
        updatedAt: row.updated_at,
      };
    }

    function mapCrewBooking(row: CrewBookingApprovalRow) {
      const vendor = firstRelation(row.vendors);
      const campaign = firstRelation(row.campaigns);
      const crewPerson = firstRelation(row.crew_person);
      const personName = vendor
        ? vendor.contact_name || vendor.company_name
        : crewPerson?.name || "Unknown";
      return {
        id: row.id,
        campaignId: row.campaign_id,
        personName,
        campaignName: campaign?.name || "Unknown",
        wfNumber: campaign?.wf_number || "",
        role: row.role,
        dayRate: Number(row.day_rate),
        classification: row.classification,
        plannedDays: (row.crew_booking_dates || []).length,
        totalAmount: (row.crew_booking_dates || []).length * Number(row.day_rate),
        createdAt: row.created_at,
      };
    }

    return NextResponse.json({
      budgetRequests,
      pendingInvoices: pendingInvoices.map((row) =>
        mapInvoice(row as InvoiceApprovalRow)
      ),
      pendingCrewBookings: (pendingCrewBookings || []).map(mapCrewBooking),
      pendingCrewPayments,
      resolvedRequests,
      resolvedInvoices: completedInvoices.map((row) =>
        mapInvoice(row as InvoiceApprovalRow)
      ),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
