import { afterEach, describe, expect, it } from "vitest";
import {
  getWorkflowPilotCampaignIds,
  parseWorkflowCampaignIdsFromSearchParams,
  parseWorkflowPilotCampaignIds,
  resolveWorkflowPilotCampaignSelection,
  resolveWorkflowPilotScope,
} from "@/lib/services/workflow-pilot.service";

const ORIGINAL_PILOT_IDS = process.env.WORKFLOW_PILOT_CAMPAIGN_IDS;

afterEach(() => {
  if (ORIGINAL_PILOT_IDS === undefined) {
    delete process.env.WORKFLOW_PILOT_CAMPAIGN_IDS;
  } else {
    process.env.WORKFLOW_PILOT_CAMPAIGN_IDS = ORIGINAL_PILOT_IDS;
  }
});

describe("workflow-pilot.service", () => {
  it("parses and deduplicates campaign IDs from env-style strings", () => {
    const ids = parseWorkflowPilotCampaignIds(
      "camp-1, camp-2, camp-1,  ,camp-3"
    );
    expect(ids).toEqual(["camp-1", "camp-2", "camp-3"]);
  });

  it("loads pilot campaign IDs from process env", () => {
    process.env.WORKFLOW_PILOT_CAMPAIGN_IDS = "alpha,beta";
    expect(getWorkflowPilotCampaignIds()).toEqual(["alpha", "beta"]);
  });

  it("resolves unknown scope values to all", () => {
    expect(resolveWorkflowPilotScope("pilot")).toBe("pilot");
    expect(resolveWorkflowPilotScope("all")).toBe("all");
    expect(resolveWorkflowPilotScope("anything-else")).toBe("all");
    expect(resolveWorkflowPilotScope(null)).toBe("all");
  });

  it("parses selected campaign IDs from query params", () => {
    const params = new URLSearchParams(
      "scope=pilot&campaignIds=camp-1,camp-2&campaignId=camp-3&campaignId=camp-2"
    );
    expect(parseWorkflowCampaignIdsFromSearchParams(params)).toEqual([
      "camp-1",
      "camp-2",
      "camp-3",
    ]);
  });

  it("prefers request campaign IDs over environment defaults", () => {
    process.env.WORKFLOW_PILOT_CAMPAIGN_IDS = "env-1,env-2";
    expect(
      resolveWorkflowPilotCampaignSelection(["request-1", "request-2"])
    ).toEqual({
      campaignIds: ["request-1", "request-2"],
      source: "request",
    });
    expect(resolveWorkflowPilotCampaignSelection()).toEqual({
      campaignIds: ["env-1", "env-2"],
      source: "environment",
    });
  });
});
