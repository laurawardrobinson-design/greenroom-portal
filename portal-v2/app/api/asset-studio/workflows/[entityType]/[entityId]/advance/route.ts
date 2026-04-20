import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { advanceWorkflowTransition } from "@/lib/services/workflow.service";
import {
  advanceWorkflowTransitionSchema,
  parseBody,
} from "@/lib/validation/asset-studio";
import type { WorkflowEntityType } from "@/types/domain";

type RouteCtx = { params: Promise<{ entityType: string; entityId: string }> };

function parseWorkflowEntityType(raw: string): WorkflowEntityType | null {
  if (raw === "dam_asset") return raw;
  return null;
}

// POST /api/asset-studio/workflows/:entityType/:entityId/advance
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

    const { entityType: rawEntityType, entityId } = await ctx.params;
    const entityType = parseWorkflowEntityType(rawEntityType);
    if (!entityType) {
      return NextResponse.json({ error: "Unsupported entityType" }, { status: 400 });
    }

    const raw = await request.json().catch(() => ({}));
    const parsed = parseBody(raw, advanceWorkflowTransitionSchema);
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const details = await advanceWorkflowTransition({
      entityType,
      entityId,
      action: parsed.data.action,
      toStage: parsed.data.toStage,
      actorId: user.id,
      actorRole: user.role,
      reason: parsed.data.reason,
      metadata: parsed.data.metadata,
    });

    return NextResponse.json(details);
  } catch (error) {
    return authErrorResponse(error);
  }
}
