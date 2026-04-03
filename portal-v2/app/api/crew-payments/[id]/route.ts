import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import { updateCrewPaymentStatus } from "@/lib/services/crew-payments.service";

// PATCH /api/crew-payments/[id]
// Actions: approve, mark_sent, mark_paid
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    const body = await request.json();

    if (body.action === "approve") {
      await requireRole(["Admin"]);
      const payment = await updateCrewPaymentStatus(id, "Approved", user.id);
      return NextResponse.json(payment);
    }

    if (body.action === "mark_sent") {
      await requireRole(["Admin"]);
      const payment = await updateCrewPaymentStatus(id, "Sent to Paymaster");
      return NextResponse.json(payment);
    }

    if (body.action === "mark_paid") {
      await requireRole(["Admin"]);
      const payment = await updateCrewPaymentStatus(id, "Paid");
      return NextResponse.json(payment);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
