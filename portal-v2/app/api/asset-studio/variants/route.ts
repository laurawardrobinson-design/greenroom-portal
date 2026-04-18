import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listVariants,
  listVariantsByRun,
  bulkApproveVariants,
  bulkRejectVariants,
} from "@/lib/services/variants.service";
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
    const limit = limitParam ? Math.max(1, Math.min(500, Number(limitParam))) : undefined;
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
    const user = await requireRole(["Admin", "Producer", "Post Producer"]);
    const body = (await request.json()) as {
      ids?: string[];
      action?: "approve" | "reject";
      reason?: string;
    };
    if (!Array.isArray(body.ids) || body.ids.length === 0 || !body.action) {
      return NextResponse.json(
        { error: "ids and action are required" },
        { status: 400 }
      );
    }
    if (body.action === "approve") {
      const count = await bulkApproveVariants(body.ids, user.id);
      return NextResponse.json({ updated: count });
    }
    const count = await bulkRejectVariants(body.ids, user.id, body.reason ?? "");
    return NextResponse.json({ updated: count });
  } catch (error) {
    return authErrorResponse(error);
  }
}
