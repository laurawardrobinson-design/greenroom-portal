import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { getRenderJobById } from "@/lib/services/render-jobs.service";

type RouteCtx = { params: Promise<{ id: string }> };

// GET /api/asset-studio/render-jobs/:id
export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer", "Art Director", "Creative Director"]);
    const { id } = await ctx.params;
    const job = await getRenderJobById(id);
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(job);
  } catch (error) {
    return authErrorResponse(error);
  }
}
