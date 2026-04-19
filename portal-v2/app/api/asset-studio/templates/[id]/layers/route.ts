import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createLayer } from "@/lib/services/templates.service";
import {
  createTemplateLayerSchema,
  parseBody,
} from "@/lib/validation/asset-studio";

type RouteCtx = { params: Promise<{ id: string }> };

// POST /api/asset-studio/templates/:id/layers — add a new layer
export async function POST(request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const { id: templateId } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const parsed = parseBody(raw, createTemplateLayerSchema);
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 });
    }
    const body = parsed.data;
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
      locales: body.locales,
    });
    return NextResponse.json(layer, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
