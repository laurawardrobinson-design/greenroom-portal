import { afterEach, describe, expect, it } from "vitest";
import { getWorkflowRolloutSignals } from "@/lib/services/workflow-rollout.service";

const ORIGINAL_PLAYBOOK_PATH = process.env.WORKFLOW_OPERATOR_PLAYBOOK_PATH;
const ORIGINAL_PLAYBOOK_REVIEWED_AT =
  process.env.WORKFLOW_OPERATOR_PLAYBOOK_REVIEWED_AT;
const ORIGINAL_ROLLBACK_DRILL_AT = process.env.WORKFLOW_ROLLBACK_DRILL_COMPLETED_AT;

afterEach(() => {
  if (ORIGINAL_PLAYBOOK_PATH === undefined) {
    delete process.env.WORKFLOW_OPERATOR_PLAYBOOK_PATH;
  } else {
    process.env.WORKFLOW_OPERATOR_PLAYBOOK_PATH = ORIGINAL_PLAYBOOK_PATH;
  }

  if (ORIGINAL_PLAYBOOK_REVIEWED_AT === undefined) {
    delete process.env.WORKFLOW_OPERATOR_PLAYBOOK_REVIEWED_AT;
  } else {
    process.env.WORKFLOW_OPERATOR_PLAYBOOK_REVIEWED_AT =
      ORIGINAL_PLAYBOOK_REVIEWED_AT;
  }

  if (ORIGINAL_ROLLBACK_DRILL_AT === undefined) {
    delete process.env.WORKFLOW_ROLLBACK_DRILL_COMPLETED_AT;
  } else {
    process.env.WORKFLOW_ROLLBACK_DRILL_COMPLETED_AT = ORIGINAL_ROLLBACK_DRILL_AT;
  }
});

describe("workflow-rollout.service", () => {
  it("returns stale drill signals when env markers are missing", () => {
    delete process.env.WORKFLOW_OPERATOR_PLAYBOOK_REVIEWED_AT;
    delete process.env.WORKFLOW_ROLLBACK_DRILL_COMPLETED_AT;

    const signals = getWorkflowRolloutSignals(new Date("2026-04-08T12:00:00.000Z"));

    expect(signals.operatorPlaybookReviewedAt).toBeNull();
    expect(signals.rollbackDrillCompletedAt).toBeNull();
    expect(signals.rollbackDrillFresh).toBe(false);
  });

  it("marks rollback drill as fresh when within recency window", () => {
    process.env.WORKFLOW_OPERATOR_PLAYBOOK_PATH = "docs/runbooks/custom.md";
    process.env.WORKFLOW_OPERATOR_PLAYBOOK_REVIEWED_AT =
      "2026-04-07T09:30:00.000Z";
    process.env.WORKFLOW_ROLLBACK_DRILL_COMPLETED_AT = "2026-04-07T10:00:00.000Z";

    const signals = getWorkflowRolloutSignals(new Date("2026-04-08T10:00:00.000Z"));

    expect(signals.operatorPlaybookPath).toBe("docs/runbooks/custom.md");
    expect(signals.operatorPlaybookReviewedAt).toBe(
      "2026-04-07T09:30:00.000Z"
    );
    expect(signals.rollbackDrillFresh).toBe(true);
    expect(signals.rollbackDrillAgeHours).toBe(24);
  });
});
