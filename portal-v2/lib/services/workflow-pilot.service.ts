export type WorkflowPilotScope = "all" | "pilot";
export type WorkflowPilotCampaignSource = "environment" | "request";

const WORKFLOW_PILOT_CAMPAIGN_IDS_ENV = "WORKFLOW_PILOT_CAMPAIGN_IDS";

export function parseWorkflowPilotCampaignIds(
  raw: string | undefined
): string[] {
  if (!raw) return [];

  const deduped = new Set<string>();
  for (const value of raw.split(",")) {
    const campaignId = value.trim();
    if (campaignId) {
      deduped.add(campaignId);
    }
  }

  return [...deduped];
}

export function getWorkflowPilotCampaignIds(): string[] {
  return parseWorkflowPilotCampaignIds(
    process.env[WORKFLOW_PILOT_CAMPAIGN_IDS_ENV]
  );
}

export function parseWorkflowCampaignIdsFromSearchParams(
  searchParams: URLSearchParams
): string[] {
  const deduped = new Set<string>();
  const csvIds = parseWorkflowPilotCampaignIds(searchParams.get("campaignIds") || undefined);
  for (const id of csvIds) deduped.add(id);

  for (const rawId of searchParams.getAll("campaignId")) {
    for (const id of parseWorkflowPilotCampaignIds(rawId)) {
      deduped.add(id);
    }
  }

  return [...deduped];
}

export function resolveWorkflowPilotScope(
  raw: string | null | undefined
): WorkflowPilotScope {
  return raw === "pilot" ? "pilot" : "all";
}

export function resolveWorkflowPilotCampaignSelection(
  requestCampaignIds?: string[] | null
): {
  campaignIds: string[];
  source: WorkflowPilotCampaignSource;
} {
  const selectedIds =
    requestCampaignIds && requestCampaignIds.length > 0
      ? [...new Set(requestCampaignIds.filter((value) => value.trim().length > 0))]
      : [];

  if (selectedIds.length > 0) {
    return {
      campaignIds: selectedIds,
      source: "request",
    };
  }

  return {
    campaignIds: getWorkflowPilotCampaignIds(),
    source: "environment",
  };
}
