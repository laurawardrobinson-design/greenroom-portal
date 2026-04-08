import { afterEach, describe, expect, it } from "vitest";
import {
  getWorkflowPilotCampaignIds,
  parseWorkflowPilotCampaignIds,
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
});
