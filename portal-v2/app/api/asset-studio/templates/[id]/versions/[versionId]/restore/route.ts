import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { restoreTemplateVersion } from "@/lib/services/templates.service";

type RouteCtx = { params: Promise<{ id: string; versionId: string }> };

// POST /api/asset-studio/templates/:id/versions/:versionId/restore
// Rolls the template's layer tree + output specs back to a prior snapshot.
// Creates a new version on restore (so the rollback itself is auditable).
export async function POST(_request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const { id, versionId } = await ctx.params;
    const template = await restoreTemplateVersion(id, versionId, user.id);
    return NextResponse.json(template);
  } catch (error) {
    return authErrorResponse(error);
  }
}
