import { NextResponse } from "next/server";
import { authErrorResponse, requireRole } from "@/lib/auth/guards";
import { isWorkflowFeatureEnabled } from "@/lib/services/feature-flags.service";
import {
  listFinanceHandoffs,
  type FinanceHandoffStatus,
} from "@/lib/services/finance-handoffs.service";
import {
  parseWorkflowCampaignIdsFromSearchParams,
  resolveWorkflowPilotCampaignSelection,
  resolveWorkflowPilotScope,
} from "@/lib/services/workflow-pilot.service";

const FINANCE_HANDOFF_STATUSES: FinanceHandoffStatus[] = [
  "pending",
  "draft_ready",
  "sent",
  "failed",
];

// GET /api/finance-handoffs?status=draft_ready|failed|...
export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer"]);
    const enabled = await isWorkflowFeatureEnabled("workflow_finance_handoff_v2");
    if (!enabled) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const statusRaw = searchParams.get("status");
    const scope = resolveWorkflowPilotScope(searchParams.get("scope"));
    const status =
      statusRaw && FINANCE_HANDOFF_STATUSES.includes(statusRaw as FinanceHandoffStatus)
        ? (statusRaw as FinanceHandoffStatus)
        : undefined;

    const requestedCampaignIds =
      parseWorkflowCampaignIdsFromSearchParams(searchParams);
    const { campaignIds: pilotCampaignIds, source: pilotCampaignSource } =
      resolveWorkflowPilotCampaignSelection(requestedCampaignIds);
    const pilotScopeActive = scope === "pilot" && pilotCampaignIds.length > 0;

    if (scope === "pilot" && !pilotScopeActive) {
      return NextResponse.json({
        items: [],
        scope,
        pilotScopeActive: false,
        pilotCampaignIds,
        pilotCampaignSource,
      });
    }

    const items = await listFinanceHandoffs({
      status,
      campaignIds: pilotScopeActive ? pilotCampaignIds : undefined,
    });
    return NextResponse.json({
      items,
      scope,
      pilotScopeActive,
      pilotCampaignIds,
      pilotCampaignSource,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
