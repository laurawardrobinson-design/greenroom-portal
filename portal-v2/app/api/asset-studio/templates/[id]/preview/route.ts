import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { renderTemplatePreview } from "@/lib/services/render.service";

// Node runtime because we're doing a sharp render inline. 30s is plenty
// for a single 1080² variant — not the 5-minute limit we give full runs.
export const runtime = "nodejs";
export const maxDuration = 30;

type RouteCtx = { params: Promise<{ id: string }> };

// POST /api/asset-studio/templates/:id/preview
// Body: { campaignProductId?: string, specId?: string, copyOverrides?: Record<string,string> }
// Returns: PNG/JPG/WEBP image bytes matching the target spec's format.
//
// Purpose: let the Designer see what a real render looks like against live
// product data before spending a full run. If no product is supplied, we
// pick the first campaign_products row we can find; if none exists we fall
// back to a placeholder.
export async function POST(request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const { id: templateId } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as {
      campaignProductId?: string;
      specId?: string;
      copyOverrides?: Record<string, string>;
    };

    const { buffer, contentType } = await renderTemplatePreview({
      templateId,
      campaignProductId: body.campaignProductId,
      specId: body.specId,
      copyOverrides: body.copyOverrides ?? {},
    });

    return new Response(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
