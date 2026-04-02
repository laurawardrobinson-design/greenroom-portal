import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { decideBudgetRequest, revertBudgetRequest } from "@/lib/services/budget.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(["Admin"]);
    const { id } = await params;
    const body = await request.json();

    // Revert action — undo an approval or decline
    if (body.action === "revert") {
      await revertBudgetRequest(id);
      return NextResponse.json({ success: true });
    }

    await decideBudgetRequest({
      requestId: id,
      approved: body.approved,
      reviewedBy: user.id,
      notes: body.notes,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
