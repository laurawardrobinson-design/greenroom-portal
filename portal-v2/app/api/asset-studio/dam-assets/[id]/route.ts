import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { getDamAsset, updateDamAsset } from "@/lib/services/dam-placeholder.service";
import { updateDamAssetSchema, parseBody } from "@/lib/validation/asset-studio";
import { logAuditEvent } from "@/lib/services/audit-log.service";

type RouteCtx = { params: Promise<{ id: string }> };

// GET /api/asset-studio/dam-assets/:id
export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer", "Art Director", "Creative Director"]);
    const { id } = await ctx.params;
    const asset = await getDamAsset(id);
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(asset);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/asset-studio/dam-assets/:id
export async function PATCH(request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Designer",
      "Art Director",
      "Creative Director",
    ]);

    const { id } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const parsed = parseBody(raw, updateDamAssetSchema);
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const body = parsed.data;
    const asset = await updateDamAsset({
      damAssetId: id,
      action: body.action,
      campaignIdForAction: body.campaignId,
      status: body.status,
      photoshopStatus: body.photoshopStatus,
      photoshopNote: body.photoshopNote,
      retouchingNotes: body.retouchingNotes,
      actorId: user.id,
      actorRole: user.role,
    });

    await logAuditEvent({
      actorId: user.id,
      actorRole: user.role,
      targetType: "dam_asset",
      targetId: id,
      action:
        body.action === "request_photoshop"
          ? "photoshop_edit_requested"
          : body.action === "link_campaign" && body.campaignId
            ? `campaign_linked:${body.campaignId}`
          : body.action === "unlink_campaign" && body.campaignId
            ? `campaign_unlinked:${body.campaignId}`
          : body.status
            ? `status_updated:${body.status}`
            : "metadata_updated",
      metadata: {
        status: asset.status,
        photoshopStatus: asset.photoshopStatus,
        campaignIds: asset.campaigns.map((c) => c.id),
      },
    });

    return NextResponse.json(asset);
  } catch (error) {
    return authErrorResponse(error);
  }
}
