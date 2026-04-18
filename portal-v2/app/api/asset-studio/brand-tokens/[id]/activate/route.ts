import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { activateBrandTokens } from "@/lib/services/brand.service";

type RouteCtx = { params: Promise<{ id: string }> };

// POST /api/asset-studio/brand-tokens/:id/activate
export async function POST(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Designer"]);
    const { id } = await ctx.params;
    const activated = await activateBrandTokens(id);
    return NextResponse.json(activated);
  } catch (error) {
    return authErrorResponse(error);
  }
}
