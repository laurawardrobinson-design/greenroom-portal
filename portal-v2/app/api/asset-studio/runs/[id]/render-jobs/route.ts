import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listRenderJobsForRun } from "@/lib/services/render-jobs.service";

type RouteCtx = { params: Promise<{ id: string }> };

// GET /api/asset-studio/runs/:id/render-jobs?limit=10
export async function GET(request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer", "Art Director"]);
    const { id } = await ctx.params;
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const parsedLimit = limitParam ? Number(limitParam) : undefined;
    const limit =
      parsedLimit != null && Number.isFinite(parsedLimit)
        ? Math.max(1, Math.min(50, Math.trunc(parsedLimit)))
        : undefined;
    const jobs = await listRenderJobsForRun(id, { limit });
    return NextResponse.json(jobs);
  } catch (error) {
    return authErrorResponse(error);
  }
}
