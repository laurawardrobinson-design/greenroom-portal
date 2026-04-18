import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createLayer } from "@/lib/services/templates.service";
import type { TemplateLayerProps, TemplateLayerType } from "@/types/domain";

type RouteCtx = { params: Promise<{ id: string }> };

// POST /api/asset-studio/templates/:id/layers — add a new layer
export async function POST(request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const { id: templateId } = await ctx.params;
    const body = (await request.json()) as {
      name?: string;
      layerType?: TemplateLayerType;
      isDynamic?: boolean;
      isLocked?: boolean;
      dataBinding?: string;
      staticValue?: string;
      xPct?: number;
      yPct?: number;
      widthPct?: number;
      heightPct?: number;
      rotationDeg?: number;
      zIndex?: number;
      sortOrder?: number;
      props?: TemplateLayerProps;
    };
    if (!body.name || !body.layerType) {
      return NextResponse.json(
        { error: "name and layerType are required" },
        { status: 400 }
      );
    }
    const layer = await createLayer({
      templateId,
      name: body.name,
      layerType: body.layerType,
      isDynamic: body.isDynamic,
      isLocked: body.isLocked,
      dataBinding: body.dataBinding,
      staticValue: body.staticValue,
      xPct: body.xPct,
      yPct: body.yPct,
      widthPct: body.widthPct,
      heightPct: body.heightPct,
      rotationDeg: body.rotationDeg,
      zIndex: body.zIndex,
      sortOrder: body.sortOrder,
      props: body.props,
    });
    return NextResponse.json(layer, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
