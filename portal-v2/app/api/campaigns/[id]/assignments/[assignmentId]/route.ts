import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { deleteCampaignAssignment } from "@/lib/services/campaign-assignments.service";

type RouteCtx = { params: Promise<{ id: string; assignmentId: string }> };

// DELETE /api/campaigns/:id/assignments/:assignmentId
// Used to remove a viewer (or any single assignment).
export async function DELETE(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Creative Director"]);
    const { assignmentId } = await ctx.params;
    await deleteCampaignAssignment(assignmentId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
