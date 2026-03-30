import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listBudgetRequests, createBudgetRequest } from "@/lib/services/budget.service";

export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer"]);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const campaignId = searchParams.get("campaignId") || undefined;
    const requests = await listBudgetRequests({ status, campaignId });
    return NextResponse.json(requests);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer"]);
    const body = await request.json();
    await createBudgetRequest({
      campaignId: body.campaignId,
      requestedBy: user.id,
      amount: body.amount,
      rationale: body.rationale,
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
