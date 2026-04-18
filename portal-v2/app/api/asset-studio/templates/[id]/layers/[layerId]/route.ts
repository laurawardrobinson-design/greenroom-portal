import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { updateLayer, deleteLayer } from "@/lib/services/templates.service";
import type { TemplateLayerProps, TemplateLayerType } from "@/types/domain";

type RouteCtx = { params: Promise<{ id: string; layerId: string }> };

// PATCH /api/asset-studio/templates/:id/layers/:layerId
export async function PATCH(request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const { layerId } = await ctx.params;
    const body = (await request.json()) as Partial<{
      name: string;
      layerType: TemplateLayerType;
      isDynamic: boolean;
      isLocked: boolean;
      dataBinding: string;
      staticValue: string;
      xPct: number;
      yPct: number;
      widthPct: number;
      heightPct: number;
      rotationDeg: number;
      zIndex: number;
      sortOrder: number;
      props: TemplateLayerProps;
    }>;
    const layer = await updateLayer(layerId, body);
    return NextResponse.json(layer);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/asset-studio/templates/:id/layers/:layerId
export async function DELETE(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const { layerId } = await ctx.params;
    await deleteLayer(layerId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
