import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { rejectVariant } from "@/lib/services/variants.service";

type RouteCtx = { params: Promise<{ id: string }> };

// POST /api/asset-studio/variants/:id/reject
// body: { reason?: string }
export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer"]);
    const { id } = await ctx.params;
    const body = (await request
      .json()
      .catch(() => ({}))) as { reason?: string };
    const variant = await rejectVariant(id, user.id, body.reason ?? "");
    return NextResponse.json(variant);
  } catch (error) {
    return authErrorResponse(error);
  }
}
