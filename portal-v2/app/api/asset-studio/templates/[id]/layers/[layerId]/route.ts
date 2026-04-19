import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { updateLayer, deleteLayer } from "@/lib/services/templates.service";
import {
  parseBody,
  updateTemplateLayerSchema,
} from "@/lib/validation/asset-studio";

type RouteCtx = { params: Promise<{ id: string; layerId: string }> };

function isPostgrestNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "PGRST116"
  );
}

// PATCH /api/asset-studio/templates/:id/layers/:layerId
export async function PATCH(request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const { id: templateId, layerId } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const parsed = parseBody(raw, updateTemplateLayerSchema);
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 });
    }
    const body = parsed.data;
    let layer: Awaited<ReturnType<typeof updateLayer>>;
    try {
      layer = await updateLayer(layerId, body, { templateId });
    } catch (error) {
      if (isPostgrestNotFound(error)) {
        return NextResponse.json({ error: "Layer not found" }, { status: 404 });
      }
      throw error;
    }
    return NextResponse.json(layer);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/asset-studio/templates/:id/layers/:layerId
export async function DELETE(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const { id: templateId, layerId } = await ctx.params;
    try {
      await deleteLayer(layerId, { templateId });
    } catch (error) {
      if (isPostgrestNotFound(error)) {
        return NextResponse.json({ error: "Layer not found" }, { status: 404 });
      }
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
