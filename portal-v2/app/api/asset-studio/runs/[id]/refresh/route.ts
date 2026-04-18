import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { refreshRunCounts } from "@/lib/services/runs.service";

type RouteCtx = { params: Promise<{ id: string }> };

// POST /api/asset-studio/runs/:id/refresh — recompute total/completed/failed counters
export async function POST(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const { id } = await ctx.params;
    const run = await refreshRunCounts(id);
    return NextResponse.json(run);
  } catch (error) {
    return authErrorResponse(error);
  }
}
