import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createDamAssetVersion } from "@/lib/services/dam-placeholder.service";
import { createDamAssetVersionSchema, parseBody } from "@/lib/validation/asset-studio";
import { logAuditEvent } from "@/lib/services/audit-log.service";

type RouteCtx = { params: Promise<{ id: string }> };

// POST /api/asset-studio/dam-assets/:id/versions
export async function POST(request: Request, ctx: RouteCtx) {
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
    const parsed = parseBody(raw, createDamAssetVersionSchema);
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const body = parsed.data;
    const version = await createDamAssetVersion({
      damAssetId: id,
      label: body.label,
      notes: body.notes,
      stage: body.stage,
      fileUrl: body.fileUrl,
      metadata: body.metadata,
      createdBy: user.id,
      createdByRole: user.role,
    });

    await logAuditEvent({
      actorId: user.id,
      actorRole: user.role,
      targetType: "dam_asset",
      targetId: id,
      action: "version_created",
      metadata: {
        versionNumber: version.versionNumber,
        stage: version.stage,
        label: version.label,
      },
    });

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
