import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  tagDamAssetProduct,
  untagDamAssetProduct,
} from "@/lib/services/dam-placeholder.service";

type RouteCtx = { params: Promise<{ id: string }> };

// POST /api/asset-studio/dam-assets/:id/products
// body: { sku: string }
// Photographer (Studio) and creative team can tag.
export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Studio",
      "Designer",
      "Art Director",
      "Creative Director",
    ]);
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const sku = typeof body.sku === "string" ? body.sku : "";
    if (!sku.trim()) {
      return NextResponse.json({ error: "sku required" }, { status: 400 });
    }
    const result = await tagDamAssetProduct({
      damAssetId: id,
      productSku: sku,
      taggedBy: user.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/asset-studio/dam-assets/:id/products?sku=<sku>
export async function DELETE(request: Request, ctx: RouteCtx) {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Studio",
      "Designer",
      "Art Director",
      "Creative Director",
    ]);
    const { id } = await ctx.params;
    const url = new URL(request.url);
    const sku = url.searchParams.get("sku") ?? "";
    if (!sku.trim()) {
      return NextResponse.json({ error: "sku required" }, { status: 400 });
    }
    await untagDamAssetProduct({ damAssetId: id, productSku: sku });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
