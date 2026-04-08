import type { WorkflowFeatureFlagKey } from "@/lib/constants/feature-flags";
import { VENDOR_STATUS_ORDER } from "@/lib/constants/statuses";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CampaignVendorStatus } from "@/types/domain";
import { getWorkflowFeatureFlagSnapshot } from "./feature-flags.service";
import {
  getWorkflowPilotCampaignIds,
  type WorkflowPilotScope,
} from "./workflow-pilot.service";

const HOUR_MS = 60 * 60 * 1000;
const ALERT_LOOKBACK_HOURS = 24;

const TERMINAL_STATUSES = new Set<CampaignVendorStatus>(["Paid", "Rejected"]);

const STALL_WARNING_HOURS: Partial<Record<CampaignVendorStatus, number>> = {
  "Estimate Submitted": 48,
  "Estimate Revision Requested": 72,
  "Estimate Approved": 72,
  "PO Uploaded": 72,
  "PO Signed": 72,
  "Shoot Complete": 48,
  "Invoice Submitted": 48,
  "Invoice Pre-Approved": 24,
};

const WORKFLOW_AUDIT_ALERT_ACTIONS = [
  "invoice_cap_violation_detected",
  "invoice_parse_not_ready_detected",
  "finance_handoff_failed",
] as const;

type WorkflowAuditAlertAction = (typeof WORKFLOW_AUDIT_ALERT_ACTIONS)[number];

type RelationRow = Record<string, unknown>;
type RelationValue = RelationRow | RelationRow[] | null | undefined;

type CampaignVendorHealthRow = {
  id: string;
  status: CampaignVendorStatus;
  updated_at: string;
  campaigns: RelationValue;
};

type FinanceHandoffHealthRow = {
  id: string;
  status: "pending" | "draft_ready" | "sent" | "failed";
  updated_at: string;
  last_error: string | null;
  campaigns: RelationValue;
};

type AuditAlertRow = {
  action: WorkflowAuditAlertAction;
  created_at: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
};

export type WorkflowHealthAlertSeverity = "critical" | "warning" | "info";

export type WorkflowHealthAlert = {
  id: string;
  severity: WorkflowHealthAlertSeverity;
  title: string;
  detail: string;
  metric: number | null;
};

export type WorkflowHealthStalledAssignment = {
  campaignVendorId: string;
  status: CampaignVendorStatus;
  wfNumber: string | null;
  campaignName: string | null;
  hoursInStatus: number;
  thresholdHours: number;
};

export type WorkflowHealthSummary = {
  activeAssignments: number;
  pendingProducerApprovals: number;
  pendingHopApprovals: number;
  oldestPendingProducerApprovalHours: number | null;
  oldestPendingHopApprovalHours: number | null;
  stalledAssignments: number;
  financeHandoffFailed: number;
  financeHandoffFailedLast24h: number;
  financeHandoffDraftReady: number;
  invoiceCapViolationsLast24h: number;
  parseNotReadyAttemptsLast24h: number;
};

export type WorkflowStatusBreakdownItem = {
  status: CampaignVendorStatus;
  count: number;
};

export type WorkflowHealthSnapshot = {
  generatedAt: string;
  scope: WorkflowPilotScope;
  pilotCampaignIds: string[];
  pilotScopeActive: boolean;
  lookbackHours: number;
  flags: Record<WorkflowFeatureFlagKey, boolean>;
  summary: WorkflowHealthSummary;
  statusBreakdown: WorkflowStatusBreakdownItem[];
  alerts: WorkflowHealthAlert[];
  stalledAssignments: WorkflowHealthStalledAssignment[];
};

export type WorkflowRegressionAlertInput = {
  flags: Record<WorkflowFeatureFlagKey, boolean>;
  summary: WorkflowHealthSummary;
  stalledAssignments: WorkflowHealthStalledAssignment[];
};

export type WorkflowHealthSnapshotOptions = {
  scope?: WorkflowPilotScope;
};

function getSingleRelationRow(value: RelationValue): RelationRow | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function safeHoursSince(isoDate: string, nowMs: number): number | null {
  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, Math.round(((nowMs - timestamp) / HOUR_MS) * 10) / 10);
}

function maxOrNull(values: Array<number | null>): number | null {
  const filtered = values.filter((value): value is number => value !== null);
  if (filtered.length === 0) return null;
  return Math.max(...filtered);
}

function summarizeStatusBreakdown(
  rows: CampaignVendorHealthRow[]
): WorkflowStatusBreakdownItem[] {
  const counts = new Map<CampaignVendorStatus, number>();
  for (const row of rows) {
    counts.set(row.status, (counts.get(row.status) || 0) + 1);
  }

  return VENDOR_STATUS_ORDER.map((status) => ({
    status,
    count: counts.get(status) || 0,
  }));
}

function findStalledAssignments(
  rows: CampaignVendorHealthRow[],
  nowMs: number
): WorkflowHealthStalledAssignment[] {
  const stalled: WorkflowHealthStalledAssignment[] = [];

  for (const row of rows) {
    const thresholdHours = STALL_WARNING_HOURS[row.status];
    if (!thresholdHours) continue;

    const hoursInStatus = safeHoursSince(row.updated_at, nowMs);
    if (hoursInStatus === null || hoursInStatus < thresholdHours) {
      continue;
    }

    const campaign = getSingleRelationRow(row.campaigns);
    stalled.push({
      campaignVendorId: row.id,
      status: row.status,
      wfNumber: (campaign?.wf_number as string | undefined) || null,
      campaignName: (campaign?.name as string | undefined) || null,
      hoursInStatus,
      thresholdHours,
    });
  }

  return stalled.sort((a, b) => b.hoursInStatus - a.hoursInStatus);
}

function summarizeAuditRows(rows: AuditAlertRow[]) {
  const counts = {
    finance_handoff_failed: 0,
    invoice_cap_violation_detected: 0,
    invoice_parse_not_ready_detected: 0,
  };

  for (const row of rows) {
    if (row.action === "finance_handoff_failed") {
      counts.finance_handoff_failed += 1;
    } else if (row.action === "invoice_cap_violation_detected") {
      counts.invoice_cap_violation_detected += 1;
    } else if (row.action === "invoice_parse_not_ready_detected") {
      counts.invoice_parse_not_ready_detected += 1;
    }
  }

  return counts;
}

function createEmptySummary(): WorkflowHealthSummary {
  return {
    activeAssignments: 0,
    pendingProducerApprovals: 0,
    pendingHopApprovals: 0,
    oldestPendingProducerApprovalHours: null,
    oldestPendingHopApprovalHours: null,
    stalledAssignments: 0,
    financeHandoffFailed: 0,
    financeHandoffFailedLast24h: 0,
    financeHandoffDraftReady: 0,
    invoiceCapViolationsLast24h: 0,
    parseNotReadyAttemptsLast24h: 0,
  };
}

function filterAuditRowsForPilotScope(
  rows: AuditAlertRow[],
  pilotAssignmentIds: Set<string>,
  pilotHandoffIds: Set<string>
): AuditAlertRow[] {
  return rows.filter((row) => {
    if (row.resource_type === "finance_handoff" && row.resource_id) {
      return pilotHandoffIds.has(row.resource_id);
    }

    if (row.resource_type === "campaign_vendor" && row.resource_id) {
      return pilotAssignmentIds.has(row.resource_id);
    }

    const metadataCampaignVendorId = row.metadata?.campaignVendorId;
    if (typeof metadataCampaignVendorId === "string") {
      return pilotAssignmentIds.has(metadataCampaignVendorId);
    }

    return false;
  });
}

export function buildWorkflowRegressionAlerts(
  input: WorkflowRegressionAlertInput
): WorkflowHealthAlert[] {
  const alerts: WorkflowHealthAlert[] = [];
  const { flags, summary, stalledAssignments } = input;

  if (summary.financeHandoffFailedLast24h > 0) {
    alerts.push({
      id: "finance-handoff-failures",
      severity: "critical",
      title: "Finance handoff retries are failing",
      detail:
        `${summary.financeHandoffFailedLast24h} handoff attempt(s) failed in the last ` +
        `${ALERT_LOOKBACK_HOURS}h.`,
      metric: summary.financeHandoffFailedLast24h,
    });
  }

  if (
    summary.pendingHopApprovals > 0 &&
    summary.oldestPendingHopApprovalHours !== null &&
    summary.oldestPendingHopApprovalHours >= 24
  ) {
    alerts.push({
      id: "hop-approval-backlog",
      severity: "warning",
      title: "Final invoice approvals are aging",
      detail:
        `${summary.pendingHopApprovals} invoice(s) are waiting for final approval. ` +
        `Oldest is ${summary.oldestPendingHopApprovalHours}h old.`,
      metric: summary.pendingHopApprovals,
    });
  }

  if (
    summary.pendingProducerApprovals > 0 &&
    summary.oldestPendingProducerApprovalHours !== null &&
    summary.oldestPendingProducerApprovalHours >= 48
  ) {
    alerts.push({
      id: "producer-approval-backlog",
      severity: "warning",
      title: "Producer invoice review queue is aging",
      detail:
        `${summary.pendingProducerApprovals} invoice(s) are waiting for producer review. ` +
        `Oldest is ${summary.oldestPendingProducerApprovalHours}h old.`,
      metric: summary.pendingProducerApprovals,
    });
  }

  if (summary.invoiceCapViolationsLast24h > 0) {
    const enforcementOn = flags.workflow_invoice_cap_enforcement_v2;
    alerts.push({
      id: "invoice-cap-violations",
      severity: enforcementOn ? "warning" : "info",
      title: "Invoice cap violations detected",
      detail: enforcementOn
        ? `${summary.invoiceCapViolationsLast24h} over-cap approval attempt(s) were blocked in the last ${ALERT_LOOKBACK_HOURS}h.`
        : `${summary.invoiceCapViolationsLast24h} over-cap attempt(s) seen in shadow mode. Consider enabling enforcement.`,
      metric: summary.invoiceCapViolationsLast24h,
    });
  }

  if (summary.parseNotReadyAttemptsLast24h > 0) {
    const enforcementOn = flags.workflow_invoice_cap_enforcement_v2;
    alerts.push({
      id: "invoice-parse-not-ready",
      severity: enforcementOn ? "warning" : "info",
      title: "Approvals attempted before invoice parse completion",
      detail: enforcementOn
        ? `${summary.parseNotReadyAttemptsLast24h} approval attempt(s) were blocked while parse was not complete in the last ${ALERT_LOOKBACK_HOURS}h.`
        : `${summary.parseNotReadyAttemptsLast24h} parse-not-ready attempt(s) logged in shadow mode. Review parser latency before cutover.`,
      metric: summary.parseNotReadyAttemptsLast24h,
    });
  }

  if (stalledAssignments.length > 0) {
    const samples = stalledAssignments
      .slice(0, 3)
      .map((item) =>
        item.wfNumber
          ? `${item.wfNumber} (${item.hoursInStatus}h in ${item.status})`
          : `${item.campaignName || "Campaign"} (${item.hoursInStatus}h in ${item.status})`
      )
      .join(", ");

    alerts.push({
      id: "stalled-assignments",
      severity: "warning",
      title: "Workflow assignments are stalled",
      detail: `${stalledAssignments.length} assignment(s) exceeded stage SLA. ${samples}`,
      metric: stalledAssignments.length,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "healthy",
      severity: "info",
      title: "No active regression signals",
      detail: `No workflow alerts fired in the last ${ALERT_LOOKBACK_HOURS}h.`,
      metric: 0,
    });
  }

  return alerts;
}

export async function getWorkflowHealthSnapshot(
  options?: WorkflowHealthSnapshotOptions
): Promise<WorkflowHealthSnapshot> {
  const db = createAdminClient();
  const generatedAt = new Date().toISOString();
  const nowMs = Date.parse(generatedAt);
  const lookbackIso = new Date(nowMs - ALERT_LOOKBACK_HOURS * HOUR_MS).toISOString();
  const scope = options?.scope || "all";
  const pilotCampaignIds = getWorkflowPilotCampaignIds();
  const pilotScopeActive = scope === "pilot" && pilotCampaignIds.length > 0;

  const flags = await getWorkflowFeatureFlagSnapshot();

  if (scope === "pilot" && !pilotScopeActive) {
    const summary = createEmptySummary();
    return {
      generatedAt,
      scope,
      pilotCampaignIds,
      pilotScopeActive: false,
      lookbackHours: ALERT_LOOKBACK_HOURS,
      flags,
      summary,
      statusBreakdown: summarizeStatusBreakdown([]),
      alerts: [
        {
          id: "pilot-scope-not-configured",
          severity: "info",
          title: "Pilot scope is not configured",
          detail:
            "Set WORKFLOW_PILOT_CAMPAIGN_IDS to a comma-separated list of campaign IDs to enable pilot monitoring.",
          metric: 0,
        },
      ],
      stalledAssignments: [],
    };
  }

  let assignmentsQuery = db
    .from("campaign_vendors")
    .select("id, campaign_id, status, updated_at, campaigns(name, wf_number)")
    .neq("status", "Invited");
  let handoffsQuery = db
    .from("finance_handoffs")
    .select(
      "id, campaign_id, status, updated_at, last_error, campaigns(name, wf_number)"
    );
  if (pilotScopeActive) {
    assignmentsQuery = assignmentsQuery.in("campaign_id", pilotCampaignIds);
    handoffsQuery = handoffsQuery.in("campaign_id", pilotCampaignIds);
  }

  const [assignmentsResult, handoffsResult, auditResult] = await Promise.all([
    assignmentsQuery,
    handoffsQuery,
    db
      .from("audit_logs")
      .select("action, created_at, resource_type, resource_id, metadata")
      .in("action", [...WORKFLOW_AUDIT_ALERT_ACTIONS])
      .gte("created_at", lookbackIso),
  ]);

  if (assignmentsResult.error) throw assignmentsResult.error;
  if (handoffsResult.error) throw handoffsResult.error;
  if (auditResult.error) throw auditResult.error;

  const assignmentRows = (assignmentsResult.data || []) as CampaignVendorHealthRow[];
  const handoffRows = (handoffsResult.data || []) as FinanceHandoffHealthRow[];
  const allAuditRows = (auditResult.data || []) as AuditAlertRow[];
  const pilotAssignmentIds = new Set(assignmentRows.map((row) => row.id));
  const pilotHandoffIds = new Set(handoffRows.map((row) => row.id));
  const auditRows = pilotScopeActive
    ? filterAuditRowsForPilotScope(allAuditRows, pilotAssignmentIds, pilotHandoffIds)
    : allAuditRows;

  const pendingProducerRows = assignmentRows.filter(
    (row) => row.status === "Invoice Submitted"
  );
  const pendingHopRows = assignmentRows.filter(
    (row) => row.status === "Invoice Pre-Approved"
  );

  const oldestPendingProducerApprovalHours = maxOrNull(
    pendingProducerRows.map((row) => safeHoursSince(row.updated_at, nowMs))
  );
  const oldestPendingHopApprovalHours = maxOrNull(
    pendingHopRows.map((row) => safeHoursSince(row.updated_at, nowMs))
  );

  const stalledAssignments = findStalledAssignments(assignmentRows, nowMs);
  const auditCounts = summarizeAuditRows(auditRows);

  const financeHandoffFailed = handoffRows.filter(
    (row) => row.status === "failed"
  ).length;
  const financeHandoffDraftReady = handoffRows.filter(
    (row) => row.status === "draft_ready"
  ).length;

  const activeAssignments = assignmentRows.filter(
    (row) => !TERMINAL_STATUSES.has(row.status)
  ).length;

  const summary: WorkflowHealthSummary = {
    activeAssignments,
    pendingProducerApprovals: pendingProducerRows.length,
    pendingHopApprovals: pendingHopRows.length,
    oldestPendingProducerApprovalHours,
    oldestPendingHopApprovalHours,
    stalledAssignments: stalledAssignments.length,
    financeHandoffFailed,
    financeHandoffFailedLast24h: auditCounts.finance_handoff_failed,
    financeHandoffDraftReady,
    invoiceCapViolationsLast24h: auditCounts.invoice_cap_violation_detected,
    parseNotReadyAttemptsLast24h: auditCounts.invoice_parse_not_ready_detected,
  };

  const alerts = buildWorkflowRegressionAlerts({
    flags,
    summary,
    stalledAssignments,
  });

  return {
    generatedAt,
    scope,
    pilotCampaignIds,
    pilotScopeActive,
    lookbackHours: ALERT_LOOKBACK_HOURS,
    flags,
    summary,
    statusBreakdown: summarizeStatusBreakdown(assignmentRows),
    alerts,
    stalledAssignments,
  };
}
