import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { deleteOutputSpec } from "@/lib/services/templates.service";

type RouteCtx = { params: Promise<{ id: string; specId: string }> };

// DELETE /api/asset-studio/templates/:id/output-specs/:specId
export async function DELETE(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const { id: templateId, specId } = await ctx.params;
    await deleteOutputSpec(specId, { templateId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
