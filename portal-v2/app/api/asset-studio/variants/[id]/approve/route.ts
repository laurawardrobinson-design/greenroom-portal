import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { approveVariant } from "@/lib/services/variants.service";

type RouteCtx = { params: Promise<{ id: string }> };

// POST /api/asset-studio/variants/:id/approve
export async function POST(_request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer"]);
    const { id } = await ctx.params;
    const variant = await approveVariant(id, user.id);
    return NextResponse.json(variant);
  } catch (error) {
    return authErrorResponse(error);
  }
}
