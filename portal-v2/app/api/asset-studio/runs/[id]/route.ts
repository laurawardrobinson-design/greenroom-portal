import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  getRun,
  updateRunStatus,
  cancelRun,
  deleteRun,
} from "@/lib/services/runs.service";
import type { VariantRunStatus } from "@/types/domain";

type RouteCtx = { params: Promise<{ id: string }> };

// GET /api/asset-studio/runs/:id — joined with variants + template + campaign
export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer", "Art Director"]);
    const { id } = await ctx.params;
    const run = await getRun(id);
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(run);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/asset-studio/runs/:id — status transitions
// body: { status?, action?: 'cancel' }
export async function PATCH(request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const { id } = await ctx.params;
    const body = (await request.json()) as {
      status?: VariantRunStatus;
      action?: "cancel";
    };
    if (body.action === "cancel") {
      const run = await cancelRun(id);
      return NextResponse.json(run);
    }
    if (body.status) {
      const run = await updateRunStatus(id, body.status);
      return NextResponse.json(run);
    }
    return NextResponse.json({ error: "Provide status or action" }, { status: 400 });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/asset-studio/runs/:id
export async function DELETE(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin"]);
    const { id } = await ctx.params;
    await deleteRun(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
