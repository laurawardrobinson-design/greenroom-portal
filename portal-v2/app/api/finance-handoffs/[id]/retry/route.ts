import { NextResponse } from "next/server";
import { authErrorResponse, getAuthUser, requireRole } from "@/lib/auth/guards";
import { isWorkflowFeatureEnabled } from "@/lib/services/feature-flags.service";
import { retryFinanceHandoffById } from "@/lib/services/finance-handoffs.service";
import {
  getRequestIpAddress,
  recordWorkflowAuditEvent,
} from "@/lib/services/workflow-audit.service";

// POST /api/finance-handoffs/[id]/retry
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    await requireRole(["Admin"]);

    const enabled = await isWorkflowFeatureEnabled("workflow_finance_handoff_v2");
    if (!enabled) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { id } = await params;
    try {
      const handoff = await retryFinanceHandoffById(id);
      await recordWorkflowAuditEvent({
        userId: user.id,
        action: "finance_handoff_created",
        resourceType: "finance_handoff",
        resourceId: handoff.id,
        ipAddress: getRequestIpAddress(request),
        metadata: { retry: true },
      });
      return NextResponse.json({ handoff });
    } catch (retryError) {
      const message =
        retryError instanceof Error ? retryError.message : "Retry failed";

      // Best effort: mark current record as failed when we can parse IDs from DB.
      if (id) {
        try {
          // We do not always know invoice/campaignVendor IDs here.
          // This endpoint still returns the failure message for operators.
          await recordWorkflowAuditEvent({
            userId: user.id,
            action: "finance_handoff_failed",
            resourceType: "finance_handoff",
            resourceId: id,
            ipAddress: getRequestIpAddress(request),
            metadata: { retry: true, error: message },
          });
        } catch {
          // Audit logging must not mask the primary retry failure.
        }
      }

      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error) {
    return authErrorResponse(error);
  }
}
