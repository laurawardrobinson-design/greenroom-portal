import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listRuns, createRun } from "@/lib/services/runs.service";
import type { VariantRunBindings, VariantRunStatus } from "@/types/domain";

// GET /api/asset-studio/runs
export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer", "Art Director"]);
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") as VariantRunStatus | null) || undefined;
    const templateId = searchParams.get("templateId") || undefined;
    const campaignId = searchParams.get("campaignId") || undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.max(1, Math.min(200, Number(limitParam))) : undefined;
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
    const body = (await request.json()) as {
      templateId?: string;
      campaignId?: string | null;
      name?: string;
      bindings?: VariantRunBindings;
      notes?: string;
    };
    if (!body.templateId || !body.name || !body.bindings) {
      return NextResponse.json(
        { error: "templateId, name, bindings are required" },
        { status: 400 }
      );
    }
    const run = await createRun({
      templateId: body.templateId,
      campaignId: body.campaignId ?? null,
      name: body.name,
      bindings: body.bindings,
      notes: body.notes,
      createdBy: user.id,
    });
    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
