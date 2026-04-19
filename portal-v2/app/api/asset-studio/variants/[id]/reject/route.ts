import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { getVariant, rejectVariant } from "@/lib/services/variants.service";
import { logAuditEvent } from "@/lib/services/audit-log.service";
import { rejectVariantSchema, parseBody } from "@/lib/validation/asset-studio";

type RouteCtx = { params: Promise<{ id: string }> };

// POST /api/asset-studio/variants/:id/reject
// body: { reason?: string }
export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Art Director"]);
    const { id } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const parsed = parseBody(raw, rejectVariantSchema);
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 });
    }
    const body = parsed.data;
    const current = await getVariant(id);
    if (!current) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }
    if (current.status !== "rendered") {
      return NextResponse.json(
        { error: "Only rendered variants can be rejected" },
        { status: 409 }
      );
    }
    const variant = await rejectVariant(id, user.id, body.reason ?? "");
    await logAuditEvent({
      actorId: user.id,
      actorRole: user.role,
      targetType: "variant",
      targetId: id,
      action: "rejected",
      reason: body.reason ?? null,
      metadata: { runId: variant.runId },
    });
    return NextResponse.json(variant);
  } catch (error) {
    return authErrorResponse(error);
  }
}
