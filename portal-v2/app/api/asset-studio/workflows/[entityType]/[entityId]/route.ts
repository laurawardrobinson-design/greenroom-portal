import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { getWorkflowInstanceDetails } from "@/lib/services/workflow.service";
import type { WorkflowEntityType } from "@/types/domain";

type RouteCtx = { params: Promise<{ entityType: string; entityId: string }> };

function parseWorkflowEntityType(raw: string): WorkflowEntityType | null {
  if (raw === "dam_asset") return raw;
  return null;
}

// GET /api/asset-studio/workflows/:entityType/:entityId
export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Designer",
      "Art Director",
    ]);

    const { entityType: rawEntityType, entityId } = await ctx.params;
    const entityType = parseWorkflowEntityType(rawEntityType);
    if (!entityType) {
      return NextResponse.json({ error: "Unsupported entityType" }, { status: 400 });
    }

    const details = await getWorkflowInstanceDetails({
      entityType,
      entityId,
      actorRole: user.role,
      ensureExists: true,
      eventLimit: 200,
    });

    if (!details) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    return NextResponse.json(details);
  } catch (error) {
    return authErrorResponse(error);
  }
}
