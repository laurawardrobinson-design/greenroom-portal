const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_OPERATOR_PLAYBOOK_PATH =
  "docs/runbooks/estimate-po-invoice-v2-operator-playbook.md";
export const WORKFLOW_ROLLBACK_DRILL_MAX_AGE_HOURS = 24 * 14;

export type WorkflowRolloutSignals = {
  operatorPlaybookPath: string;
  operatorPlaybookReviewedAt: string | null;
  rollbackDrillCompletedAt: string | null;
  rollbackDrillAgeHours: number | null;
  rollbackDrillFresh: boolean;
  rollbackDrillMaxAgeHours: number;
};

function parseIsoTimestamp(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

export function getWorkflowRolloutSignals(
  now = new Date()
): WorkflowRolloutSignals {
  const nowMs = now.getTime();
  const operatorPlaybookPath =
    process.env.WORKFLOW_OPERATOR_PLAYBOOK_PATH?.trim() ||
    DEFAULT_OPERATOR_PLAYBOOK_PATH;
  const operatorPlaybookReviewedAt = parseIsoTimestamp(
    process.env.WORKFLOW_OPERATOR_PLAYBOOK_REVIEWED_AT
  );
  const rollbackDrillCompletedAt = parseIsoTimestamp(
    process.env.WORKFLOW_ROLLBACK_DRILL_COMPLETED_AT
  );

  let rollbackDrillAgeHours: number | null = null;
  if (rollbackDrillCompletedAt) {
    const drillMs = Date.parse(rollbackDrillCompletedAt);
    if (!Number.isNaN(drillMs) && drillMs <= nowMs) {
      rollbackDrillAgeHours = Math.round(((nowMs - drillMs) / HOUR_MS) * 10) / 10;
    }
  }

  return {
    operatorPlaybookPath,
    operatorPlaybookReviewedAt,
    rollbackDrillCompletedAt,
    rollbackDrillAgeHours,
    rollbackDrillFresh:
      rollbackDrillAgeHours !== null &&
      rollbackDrillAgeHours <= WORKFLOW_ROLLBACK_DRILL_MAX_AGE_HOURS,
    rollbackDrillMaxAgeHours: WORKFLOW_ROLLBACK_DRILL_MAX_AGE_HOURS,
  };
}
