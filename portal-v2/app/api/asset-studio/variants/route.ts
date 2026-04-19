import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listVariants,
  listVariantsByRun,
  listVariantIdsByStatus,
  bulkApproveVariants,
  bulkRejectVariants,
} from "@/lib/services/variants.service";
import { logAuditEvent } from "@/lib/services/audit-log.service";
import { bulkVariantActionSchema, parseBody } from "@/lib/validation/asset-studio";
import type { VariantStatus } from "@/types/domain";

// GET /api/asset-studio/variants?runId=&status=&templateId=&limit=
export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer", "Art Director"]);
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");
    if (runId) {
      const variants = await listVariantsByRun(runId);
      return NextResponse.json(variants);
    }
    const status = (searchParams.get("status") as VariantStatus | null) || undefined;
    const templateId = searchParams.get("templateId") || undefined;
    const limitParam = searchParams.get("limit");
    const parsedLimit = limitParam ? Number(limitParam) : NaN;
    const limit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(500, Math.trunc(parsedLimit)))
      : undefined;
    const variants = await listVariants({ status, templateId, limit });
    return NextResponse.json(variants);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/asset-studio/variants — bulk approve/reject
// body: { ids: string[], action: 'approve' | 'reject', reason? }
export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Art Director"]);
    const raw = await request.json().catch(() => ({}));
    const parsed = parseBody(raw, bulkVariantActionSchema);
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 });
    }
    const body = parsed.data;
    const eligibleIds = await listVariantIdsByStatus(body.ids, "rendered");
    const skipped = body.ids.length - eligibleIds.length;
    if (eligibleIds.length === 0) {
      return NextResponse.json({ updated: 0, skipped });
    }

    if (body.action === "approve") {
      const count = await bulkApproveVariants(eligibleIds, user.id);
      // Log each variant so the feed shows exactly what was touched.
      // Parallel fire-and-forget — audit log failures are swallowed inside the helper.
      await Promise.all(
        eligibleIds.map((vid) =>
          logAuditEvent({
            actorId: user.id,
            actorRole: user.role,
            targetType: "variant",
            targetId: vid,
            action: "bulk_approved",
          })
        )
      );
      return NextResponse.json({ updated: count, skipped });
    }
    const count = await bulkRejectVariants(eligibleIds, user.id, body.reason ?? "");
    await Promise.all(
      eligibleIds.map((vid) =>
        logAuditEvent({
          actorId: user.id,
          actorRole: user.role,
          targetType: "variant",
          targetId: vid,
          action: "bulk_rejected",
          reason: body.reason ?? null,
        })
      )
    );
    return NextResponse.json({ updated: count, skipped });
  } catch (error) {
    return authErrorResponse(error);
  }
}
