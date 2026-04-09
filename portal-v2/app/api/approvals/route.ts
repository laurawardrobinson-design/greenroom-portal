import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listBudgetRequests } from "@/lib/services/budget.service";
import { listPendingCrewPayments } from "@/lib/services/crew-payments.service";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/approvals — pending + resolved items for HOP
export async function GET() {
  try {
    await requireRole(["Admin"]);
    const db = createAdminClient();

    // All budget requests (pending + resolved)
    const allRequests = await listBudgetRequests();
    const budgetRequests = allRequests.filter((r) => r.status === "Pending");
    const resolvedRequests = allRequests.filter((r) => r.status !== "Pending");

    // Pending invoice approvals (Invoice Pre-Approved → needs HOP approval)
    const { data: pendingInvoices } = await db
      .from("campaign_vendors")
      .select("*, vendors(company_name), campaigns(name, wf_number)")
      .eq("status", "Invoice Pre-Approved")
      .order("updated_at", { ascending: false });

    // Resolved invoice approvals (Invoice Approved or Paid)
    const { data: completedInvoices } = await db
      .from("campaign_vendors")
      .select("*, vendors(company_name), campaigns(name, wf_number)")
      .in("status", ["Invoice Approved", "Paid"])
      .order("updated_at", { ascending: false })
      .limit(50);

    function mapInvoice(row: any) {
      return {
        id: row.id,
        campaignId: row.campaign_id,
        vendorName: row.vendors?.company_name || "Unknown",
        campaignName: row.campaigns?.name || "Unknown",
        wfNumber: row.campaigns?.wf_number || "",
        estimateTotal: Number(row.estimate_total),
        invoiceTotal: Number(row.invoice_total),
        status: row.status,
        updatedAt: row.updated_at,
      };
    }

    // Pending crew booking approvals (rate exceeds standard → needs HOP)
    const { data: pendingCrewBookings } = await db
      .from("crew_bookings")
      .select("*, vendors(company_name, contact_name), users(name), campaigns(name, wf_number), crew_booking_dates(*)")
      .eq("status", "Pending Approval")
      .order("created_at", { ascending: false });

    // Resolved crew booking approvals (approved or cancelled)
    const { data: resolvedCrewBookingsRaw } = await db
      .from("crew_bookings")
      .select("*, vendors(company_name, contact_name), users(name), campaigns(name, wf_number), crew_booking_dates(*)")
      .in("status", ["Rate Approved", "Confirmed", "Days Confirmed", "Completed", "Cancelled"])
      .not("status", "eq", "Pending Approval")
      .order("created_at", { ascending: false })
      .limit(50);

    function mapCrewBooking(row: any) {
      const personName = row.vendors
        ? row.vendors.contact_name || row.vendors.company_name
        : row.users?.name || "Unknown";
      return {
        id: row.id,
        campaignId: row.campaign_id,
        personName,
        campaignName: row.campaigns?.name || "Unknown",
        wfNumber: row.campaigns?.wf_number || "",
        role: row.role,
        dayRate: Number(row.day_rate),
        classification: row.classification,
        plannedDays: (row.crew_booking_dates || []).length,
        totalAmount: (row.crew_booking_dates || []).length * Number(row.day_rate),
        status: row.status,
        createdAt: row.created_at,
      };
    }

    // Pending crew payment approvals (days confirmed → awaiting HOP to approve for paymaster)
    const pendingCrewPayments = await listPendingCrewPayments();

    // Resolved crew payments (approved, sent, or paid)
    const { data: resolvedCrewPaymentsRaw } = await db
      .from("crew_payments")
      .select(
        "*, crew_bookings!inner(campaign_id, role, vendor_id, user_id, vendors(contact_name, company_name), crew_person:users!crew_bookings_user_id_fkey(name), campaigns(name, wf_number))"
      )
      .in("status", ["Approved", "Sent to Paymaster", "Paid"])
      .order("created_at", { ascending: false })
      .limit(50);

    function mapCrewPayment(row: any) {
      const booking = row.crew_bookings;
      const personName = booking?.vendors
        ? booking.vendors.contact_name || booking.vendors.company_name
        : booking?.crew_person?.name || "Unknown";
      return {
        id: row.id,
        bookingId: row.booking_id,
        campaignId: booking?.campaign_id || "",
        personName,
        role: booking?.role || "",
        campaignName: booking?.campaigns?.name || "",
        wfNumber: booking?.campaigns?.wf_number || "",
        totalDays: Number(row.total_days),
        totalAmount: Number(row.total_amount),
        status: row.status,
        confirmedAt: row.confirmed_at,
        createdAt: row.created_at,
      };
    }

    return NextResponse.json({
      budgetRequests,
      pendingInvoices: (pendingInvoices || []).map(mapInvoice),
      pendingCrewBookings: (pendingCrewBookings || []).map(mapCrewBooking),
      pendingCrewPayments,
      resolvedRequests,
      resolvedInvoices: (completedInvoices || []).map(mapInvoice),
      resolvedCrewBookings: (resolvedCrewBookingsRaw || []).map(mapCrewBooking),
      resolvedCrewPayments: (resolvedCrewPaymentsRaw || []).map(mapCrewPayment),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
