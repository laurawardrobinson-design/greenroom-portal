export type WorkflowPilotScope = "all" | "pilot";

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

export function resolveWorkflowPilotScope(
  raw: string | null | undefined
): WorkflowPilotScope {
  return raw === "pilot" ? "pilot" : "all";
}
