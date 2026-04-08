"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { AlertTriangle, Mail, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";

type FinanceHandoffItem = {
  id: string;
  invoiceId: string;
  campaignVendorId: string;
  status: "pending" | "draft_ready" | "sent" | "failed";
  attemptCount: number;
  lastAttemptAt: string | null;
  lastError: string;
  emailTo: string[];
  emailCc: string[];
  emailSubject: string;
  campaignName: string | null;
  wfNumber: string | null;
  vendorName: string | null;
  updatedAt: string;
};

type WorkflowHealthAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  metric: number | null;
};

type WorkflowCutoverReadinessCheck = {
  id: string;
  label: string;
  passed: boolean;
  required: boolean;
  detail: string;
};

type WorkflowCutoverReadiness = {
  ready: boolean;
  blockers: string[];
  checks: WorkflowCutoverReadinessCheck[];
};

type WorkflowHealthScope = "all" | "pilot";

type WorkflowHealthSnapshot = {
  generatedAt: string;
  scope: WorkflowHealthScope;
  pilotCampaignIds: string[];
  pilotCampaignSource: "environment" | "request";
  pilotScopeActive: boolean;
  lookbackHours: number;
  operations: {
    operatorPlaybookPath: string;
    operatorPlaybookReviewedAt: string | null;
    rollbackDrillCompletedAt: string | null;
    rollbackDrillAgeHours: number | null;
    rollbackDrillFresh: boolean;
    rollbackDrillMaxAgeHours: number;
  };
  summary: {
    activeAssignments: number;
    pendingProducerApprovals: number;
    pendingHopApprovals: number;
    stalledAssignments: number;
    financeHandoffFailedLast24h: number;
    invoiceCapViolationsLast24h: number;
    parseNotReadyAttemptsLast24h: number;
  };
  alerts: WorkflowHealthAlert[];
  cutoverReadiness: WorkflowCutoverReadiness;
};

type FinanceHandoffResponse = {
  items: FinanceHandoffItem[];
  scope?: WorkflowHealthScope;
  pilotScopeActive?: boolean;
  pilotCampaignIds?: string[];
  pilotCampaignSource?: "environment" | "request";
};

const fetcher = async (url: string): Promise<FinanceHandoffResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || "Failed to load finance handoffs");
  }
  return res.json();
};

const healthFetcher = async (url: string): Promise<WorkflowHealthSnapshot> => {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || "Failed to load workflow health");
  }
  return res.json();
};

const STATUS_STYLE: Record<FinanceHandoffItem["status"], string> = {
  pending: "bg-slate-100 text-slate-700",
  draft_ready: "bg-blue-50 text-blue-700",
  sent: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
};

const ALERT_STYLE: Record<
  WorkflowHealthAlert["severity"],
  {
    badge: "error" | "warning" | "info";
    border: string;
    background: string;
  }
> = {
  critical: {
    badge: "error",
    border: "border-red-200",
    background: "bg-red-50/60",
  },
  warning: {
    badge: "warning",
    border: "border-amber-200",
    background: "bg-amber-50/60",
  },
  info: {
    badge: "info",
    border: "border-blue-200",
    background: "bg-blue-50/60",
  },
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function FinanceHandoffsPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<
    "all" | FinanceHandoffItem["status"]
  >("all");
  const [healthScope, setHealthScope] = useState<WorkflowHealthScope>("all");
  const [pilotCampaignFilter, setPilotCampaignFilter] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const normalizedPilotCampaignFilter = pilotCampaignFilter
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(",");

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (healthScope === "pilot") queryParams.set("scope", "pilot");
  if (healthScope === "pilot" && normalizedPilotCampaignFilter) {
    queryParams.set("campaignIds", normalizedPilotCampaignFilter);
  }
  const query = queryParams.toString();
  const { data, error, isLoading, mutate } = useSWR(
    `/api/finance-handoffs${query ? `?${query}` : ""}`,
    fetcher
  );

  const healthQueryParams = new URLSearchParams({
    scope: healthScope,
  });
  if (healthScope === "pilot" && normalizedPilotCampaignFilter) {
    healthQueryParams.set("campaignIds", normalizedPilotCampaignFilter);
  }
  const healthQuery = healthQueryParams.toString();
  const {
    data: health,
    error: healthError,
    isLoading: healthLoading,
    mutate: mutateHealth,
  } = useSWR(`/api/admin/workflow-health?${healthQuery}`, healthFetcher, {
    refreshInterval: 60_000,
  });

  const items = useMemo(() => data?.items || [], [data?.items]);
  const failedCount = useMemo(
    () => items.filter((item) => item.status === "failed").length,
    [items]
  );
  const handoffPilotScopeInactive =
    healthScope === "pilot" && data?.pilotScopeActive === false;
  const handoffPilotCampaignCount = data?.pilotCampaignIds?.length || 0;
  const healthPilotCampaignSource = health?.pilotCampaignSource;
  const summary = health?.summary;
  const cutoverReadiness = health?.cutoverReadiness;
  const regressionSignals = summary
    ? summary.invoiceCapViolationsLast24h +
      summary.parseNotReadyAttemptsLast24h +
      summary.financeHandoffFailedLast24h
    : 0;

  async function handleRetry(handoffId: string) {
    setRetryingId(handoffId);
    try {
      const res = await fetch(`/api/finance-handoffs/${handoffId}/retry`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Retry failed");
      }
      toast("success", "Finance handoff retried");
      await Promise.all([mutate(), mutateHealth()]);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Handoffs"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={healthScope}
              onChange={(event) =>
                setHealthScope(event.target.value as WorkflowHealthScope)
              }
              className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Health: All campaigns</option>
              <option value="pilot">Health: Pilot only</option>
            </select>
            {healthScope === "pilot" && (
              <input
                value={pilotCampaignFilter}
                onChange={(event) => setPilotCampaignFilter(event.target.value)}
                placeholder="Campaign IDs (comma separated)"
                className="h-9 w-64 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            )}
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "all" | FinanceHandoffItem["status"]
                )
              }
              className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="draft_ready">Draft Ready</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
            <Badge variant={failedCount > 0 ? "error" : "info"}>
              {failedCount} failed
            </Badge>
          </div>
        }
      />

      {healthLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Card key={index}>
              <div className="h-14 animate-pulse rounded-lg bg-surface-secondary" />
            </Card>
          ))}
        </div>
      ) : healthError ? (
        <Card>
          <p className="text-sm font-medium text-text-primary">
            Workflow health metrics unavailable
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {healthError instanceof Error
              ? healthError.message
              : "Could not load regression telemetry."}
          </p>
        </Card>
      ) : summary ? (
        <div className="space-y-3">
          {health.scope === "pilot" && (
            <Card>
              <p className="text-sm font-medium text-text-primary">
                {health.pilotScopeActive
                  ? `Pilot scope active (${health.pilotCampaignIds.length} campaign${
                      health.pilotCampaignIds.length === 1 ? "" : "s"
                    } ${
                      healthPilotCampaignSource === "request"
                        ? "selected in this dashboard"
                        : "from environment configuration"
                    })`
                  : "Pilot scope selected with no configured campaigns"}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {health.pilotScopeActive
                  ? healthPilotCampaignSource === "request"
                    ? `Metrics and handoff list are filtered to the selected campaign IDs (${handoffPilotCampaignCount} campaign${handoffPilotCampaignCount === 1 ? "" : "s"} currently matching handoff queries).`
                    : `Metrics and handoff list are filtered by WORKFLOW_PILOT_CAMPAIGN_IDS (${handoffPilotCampaignCount} campaign${handoffPilotCampaignCount === 1 ? "" : "s"} currently matching handoff queries).`
                  : pilotCampaignFilter.trim()
                    ? "No valid campaign IDs matched. Check the ID list and try again."
                    : "Set WORKFLOW_PILOT_CAMPAIGN_IDS or enter campaign IDs above to enable pilot-filtered monitoring."}
              </p>
              {handoffPilotScopeInactive && (
                <p className="mt-1 text-xs text-amber-700">
                  Handoff list pilot scope is currently inactive because no campaign IDs are configured.
                </p>
              )}
            </Card>
          )}

          <Card>
            <p className="text-sm font-medium text-text-primary">
              Rollout Operations
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Playbook: <span className="font-mono">{health.operations.operatorPlaybookPath}</span>
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Playbook reviewed:{" "}
              {formatDateTime(health.operations.operatorPlaybookReviewedAt)}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Rollback drill: {formatDateTime(health.operations.rollbackDrillCompletedAt)}{" "}
              {health.operations.rollbackDrillAgeHours !== null
                ? `(${health.operations.rollbackDrillAgeHours}h ago)`
                : ""}
            </p>
            <Badge
              variant={health.operations.rollbackDrillFresh ? "success" : "warning"}
              className="mt-2"
            >
              {health.operations.rollbackDrillFresh
                ? "Rollback drill current"
                : `Rollback drill stale/missing (max ${health.operations.rollbackDrillMaxAgeHours}h)`}
            </Badge>
          </Card>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Card>
              <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
                {health.scope === "pilot"
                  ? "Active Pilot Workflows"
                  : "Active Workflows"}
              </p>
              <p className="mt-1 text-2xl font-semibold text-text-primary">
                {summary.activeAssignments}
              </p>
            </Card>
            <Card>
              <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
                Pending Producer Approval
              </p>
              <p className="mt-1 text-2xl font-semibold text-text-primary">
                {summary.pendingProducerApprovals}
              </p>
            </Card>
            <Card>
              <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
                Pending Final Approval
              </p>
              <p className="mt-1 text-2xl font-semibold text-text-primary">
                {summary.pendingHopApprovals}
              </p>
            </Card>
            <Card>
              <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
                Stalled Assignments
              </p>
              <p className="mt-1 text-2xl font-semibold text-text-primary">
                {summary.stalledAssignments}
              </p>
            </Card>
            <Card>
              <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
                {health.scope === "pilot" ? "Pilot Signals" : "Regression Signals"} (
                {health.lookbackHours}h)
              </p>
              <p className="mt-1 text-2xl font-semibold text-text-primary">
                {regressionSignals}
              </p>
            </Card>
          </div>

          <Card>
            <CardHeader className="mb-2">
              <div>
                <CardTitle className="text-sm">Regression Alerts</CardTitle>
                <p className="mt-1 text-xs text-text-tertiary">
                  Snapshot generated {formatDateTime(health.generatedAt)}
                </p>
              </div>
            </CardHeader>
            <div className="space-y-2">
              {health.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-lg border px-3 py-2 ${ALERT_STYLE[alert.severity].border} ${ALERT_STYLE[alert.severity].background}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-text-primary">
                      {alert.title}
                    </p>
                    <Badge variant={ALERT_STYLE[alert.severity].badge}>
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {alert.detail}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {cutoverReadiness && (
            <Card>
              <CardHeader className="mb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">Cutover Readiness</CardTitle>
                  <Badge variant={cutoverReadiness.ready ? "success" : "warning"}>
                    {cutoverReadiness.ready ? "Ready" : "Blocked"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-text-tertiary">
                  Gate checklist for pilot rollout and v1 cutover.
                </p>
              </CardHeader>
              <div className="space-y-2">
                {!cutoverReadiness.ready && cutoverReadiness.blockers.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-medium text-amber-800">
                      Blockers: {cutoverReadiness.blockers.join("; ")}
                    </p>
                  </div>
                )}
                {cutoverReadiness.checks.map((check) => (
                  <div
                    key={check.id}
                    className={`rounded-lg border px-3 py-2 ${
                      check.passed
                        ? "border-emerald-200 bg-emerald-50/50"
                        : "border-amber-200 bg-amber-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-text-primary">{check.label}</p>
                      <Badge variant={check.passed ? "success" : "warning"}>
                        {check.passed ? "Pass" : "Needs action"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">{check.detail}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <div className="h-28 animate-pulse rounded-lg bg-surface-secondary" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Could not load handoffs"
          description={
            error instanceof Error
              ? error.message
              : "Unexpected error loading finance handoffs."
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Mail className="h-5 w-5" />}
          title="No handoffs yet"
          description="HOP-approved invoices will create finance handoff records here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader className="mb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                    {item.wfNumber || "WF —"}
                  </p>
                  <CardTitle className="text-sm">
                    {item.campaignName || "Campaign"}
                  </CardTitle>
                  <p className="text-xs text-text-secondary">
                    {item.vendorName || "Vendor"}
                  </p>
                </div>
                <Badge variant="custom" className={STATUS_STYLE[item.status]}>
                  {item.status.replace("_", " ")}
                </Badge>
              </CardHeader>

              <div className="space-y-2">
                <p className="text-xs text-text-secondary">
                  <span className="font-medium text-text-primary">Subject:</span>{" "}
                  {item.emailSubject || "Draft not generated yet"}
                </p>
                <p className="text-xs text-text-secondary">
                  <span className="font-medium text-text-primary">To:</span>{" "}
                  {item.emailTo.length > 0 ? item.emailTo.join(", ") : "—"}
                </p>
                {item.emailCc.length > 0 && (
                  <p className="text-xs text-text-secondary">
                    <span className="font-medium text-text-primary">CC:</span>{" "}
                    {item.emailCc.join(", ")}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-text-tertiary">
                  <span>Attempts: {item.attemptCount}</span>
                  <span>Last run: {formatDateTime(item.lastAttemptAt)}</span>
                </div>

                {item.lastError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {item.lastError}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-text-tertiary">
                    Updated {formatDateTime(item.updatedAt)}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleRetry(item.id)}
                    loading={retryingId === item.id}
                    disabled={retryingId !== null}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
