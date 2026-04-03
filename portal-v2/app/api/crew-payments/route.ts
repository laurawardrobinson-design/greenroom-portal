import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listCrewPaymentsByCampaign,
  listPendingCrewPayments,
} from "@/lib/services/crew-payments.service";

// GET /api/crew-payments?campaignId=... — list payments for a campaign
// GET /api/crew-payments?pending=true — list all pending (HOP view)
export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    const pending = searchParams.get("pending");

    if (pending === "true") {
      await requireRole(["Admin"]);
      const payments = await listPendingCrewPayments();
      return NextResponse.json(payments);
    }

    if (campaignId) {
      if (user.role === "Vendor") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const payments = await listCrewPaymentsByCampaign(campaignId);
      return NextResponse.json(payments);
    }

    return NextResponse.json({ error: "Missing campaignId or pending param" }, { status: 400 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
