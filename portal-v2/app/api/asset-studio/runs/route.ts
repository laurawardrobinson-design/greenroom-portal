import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listRuns, createRun } from "@/lib/services/runs.service";
import { logAuditEvent } from "@/lib/services/audit-log.service";
import { createRunSchema, parseBody } from "@/lib/validation/asset-studio";
import type { VariantRunStatus } from "@/types/domain";

// GET /api/asset-studio/runs
export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer", "Art Director", "Creative Director"]);
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") as VariantRunStatus | null) || undefined;
    const templateId = searchParams.get("templateId") || undefined;
    const campaignId = searchParams.get("campaignId") || undefined;
    const limitParam = searchParams.get("limit");
    const parsedLimit = limitParam ? Number(limitParam) : NaN;
    const limit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(200, Math.trunc(parsedLimit)))
      : undefined;
    const runs = await listRuns({ status, templateId, campaignId, limit });
    return NextResponse.json(runs);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/asset-studio/runs
// body: { templateId, campaignId?, name, bindings, notes? }
export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const raw = await request.json().catch(() => ({}));
    const parsed = parseBody(raw, createRunSchema);
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 });
    }
    const body = parsed.data;
    const run = await createRun({
      templateId: body.templateId,
      campaignId: body.campaignId ?? null,
      name: body.name,
      bindings: body.bindings,
      notes: body.notes,
      createdBy: user.id,
    });
    await logAuditEvent({
      actorId: user.id,
      actorRole: user.role,
      targetType: "variant_run",
      targetId: run.id,
      action: "created",
      metadata: {
        templateId: run.templateId,
        templateVersionId: run.templateVersionId,
        totalVariants: run.totalVariants,
        perRowOverrideCount: Object.keys(
          body.bindings.copy_overrides_by_product ?? {}
        ).length,
      },
    });
    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
