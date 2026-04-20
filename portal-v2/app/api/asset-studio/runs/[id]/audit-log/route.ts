import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listAuditEventsForRun } from "@/lib/services/audit-log.service";
import { listVariantsByRun } from "@/lib/services/variants.service";

type RouteCtx = { params: Promise<{ id: string }> };

// GET /api/asset-studio/runs/:id/audit-log
// Returns the union of run-level and variant-level events, most recent first.
export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Designer",
      "Art Director",
      "Creative Director",
    ]);
    const { id } = await ctx.params;
    // Resolve variant ids so we pick up approve/reject events for them too.
    const variants = await listVariantsByRun(id);
    const variantIds = variants.map((v) => v.id);
    const events = await listAuditEventsForRun(id, variantIds);
    return NextResponse.json(events);
  } catch (error) {
    return authErrorResponse(error);
  }
}
