import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  getVariant,
  updateVariantStatus,
  deleteVariant,
} from "@/lib/services/variants.service";
import { parseBody, updateVariantSchema } from "@/lib/validation/asset-studio";

type RouteCtx = { params: Promise<{ id: string }> };

// GET /api/asset-studio/variants/:id
export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer", "Art Director", "Creative Director"]);
    const { id } = await ctx.params;
    const variant = await getVariant(id);
    if (!variant) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(variant);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/asset-studio/variants/:id
// body: { status, assetUrl?, storagePath?, thumbnailUrl?, errorMessage? }
export async function PATCH(request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const { id } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const parsed = parseBody(raw, updateVariantSchema);
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 });
    }
    const body = parsed.data;
    const variant = await updateVariantStatus(id, body.status, {
      assetUrl: body.assetUrl,
      storagePath: body.storagePath,
      thumbnailUrl: body.thumbnailUrl,
      errorMessage: body.errorMessage,
    });
    return NextResponse.json(variant);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/asset-studio/variants/:id
export async function DELETE(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin"]);
    const { id } = await ctx.params;
    await deleteVariant(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
