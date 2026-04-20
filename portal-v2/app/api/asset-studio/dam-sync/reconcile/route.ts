import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { reconcileDamAssetSyncState } from "@/lib/services/dam-sync.service";
import { parseBody, reconcileDamSyncSchema } from "@/lib/validation/asset-studio";

// POST /api/asset-studio/dam-sync/reconcile
// body: { damAssetId, reason? }
export async function POST(request: Request) {
  try {
    const user = await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Designer",
      "Art Director",
      "Creative Director",
    ]);

    const raw = await request.json().catch(() => ({}));
    const parsed = parseBody(raw, reconcileDamSyncSchema);
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const reconciled = await reconcileDamAssetSyncState({
      damAssetId: parsed.data.damAssetId,
      actorId: user.id,
      actorRole: user.role,
      reason: parsed.data.reason,
    });

    return NextResponse.json({
      damAssetId: parsed.data.damAssetId,
      ...reconciled,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
