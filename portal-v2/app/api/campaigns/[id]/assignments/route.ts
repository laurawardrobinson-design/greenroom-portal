import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listCampaignAssignments,
  upsertCampaignAssignment,
  clearPrimaryAssignment,
  type AssignmentRole,
} from "@/lib/services/campaign-assignments.service";

type RouteCtx = { params: Promise<{ id: string }> };

const VALID_ROLES: AssignmentRole[] = ["primary_designer", "primary_art_director", "viewer"];

// GET /api/campaigns/:id/assignments
export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Designer",
      "Art Director",
      "Creative Director",
    ]);
    const { id } = await ctx.params;
    const assignments = await listCampaignAssignments(id);
    return NextResponse.json(assignments);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/campaigns/:id/assignments
// body: { userId: string, assignmentRole: "primary_designer" | "primary_art_director" | "viewer" }
// For primary_* roles, replaces the current holder (one per campaign).
// Passing userId=null for primary_* clears it.
export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole(["Admin", "Producer", "Creative Director"]);
    const { id } = await ctx.params;
    const body = await request.json();

    const role = body.assignmentRole as AssignmentRole | undefined;
    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid assignmentRole" }, { status: 400 });
    }

    // userId=null on a primary role clears it.
    if (body.userId === null && (role === "primary_designer" || role === "primary_art_director")) {
      await clearPrimaryAssignment(id, role);
      return NextResponse.json({ cleared: true, assignmentRole: role });
    }

    if (typeof body.userId !== "string" || body.userId.length === 0) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const assignment = await upsertCampaignAssignment({
      campaignId: id,
      userId: body.userId,
      assignmentRole: role,
      assignedBy: user.id,
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
