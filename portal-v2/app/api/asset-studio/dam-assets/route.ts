import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  ingestCampaignAssetToDam,
  listDamAssets,
  listDamSources,
} from "@/lib/services/dam-placeholder.service";
import { ingestDamAssetSchema, parseBody } from "@/lib/validation/asset-studio";
import { logAuditEvent } from "@/lib/services/audit-log.service";
import type { DamAssetStatus } from "@/types/domain";

const ALLOWED_STATUSES: DamAssetStatus[] = [
  "ingested",
  "retouching",
  "retouched",
  "versioning",
  "ready_for_activation",
  "archived",
];

// GET /api/asset-studio/dam-assets?campaignId=&status=&includeSources=true
export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer", "Art Director"]);

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId") || undefined;
    const includeSources = searchParams.get("includeSources") !== "false";

    const rawStatus = searchParams.get("status");
    const status = rawStatus && ALLOWED_STATUSES.includes(rawStatus as DamAssetStatus)
      ? (rawStatus as DamAssetStatus)
      : undefined;

    const [assets, sourceAssets] = await Promise.all([
      listDamAssets({ campaignId, status, limit: 300 }),
      includeSources
        ? listDamSources({ campaignId, limit: 300 })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({ assets, sourceAssets });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/asset-studio/dam-assets
// body: { campaignAssetId }
export async function POST(request: Request) {
  try {
    const user = await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Designer",
      "Art Director",
    ]);

    const raw = await request.json().catch(() => ({}));
    const parsed = parseBody(raw, ingestDamAssetSchema);
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const damAsset = await ingestCampaignAssetToDam({
      campaignAssetId: parsed.data.campaignAssetId,
      createdBy: user.id,
    });

    await logAuditEvent({
      actorId: user.id,
      actorRole: user.role,
      targetType: "dam_asset",
      targetId: damAsset.id,
      action: "ingested",
      metadata: {
        campaignId: damAsset.campaignId,
        sourceCampaignAssetId: damAsset.sourceCampaignAssetId,
      },
    });

    return NextResponse.json(damAsset, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
