import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { renderRun } from "@/lib/services/render.service";

// Rendering is CPU-bound and we upload to storage — keep the route on Node runtime
// and give it headroom.
export const runtime = "nodejs";
export const maxDuration = 300;

type RouteCtx = { params: Promise<{ id: string }> };

// POST /api/asset-studio/runs/:id/render — run sharp pipeline for pending variants
export async function POST(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const { id } = await ctx.params;
    const result = await renderRun(id);
    return NextResponse.json(result);
  } catch (error) {
    return authErrorResponse(error);
  }
}
