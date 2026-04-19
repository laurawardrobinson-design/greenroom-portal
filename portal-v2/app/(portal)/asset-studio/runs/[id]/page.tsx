"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useToast } from "@/components/ui/toast";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Check,
  Download,
  ImageOff,
  PlayCircle,
  RefreshCw,
  StopCircle,
  Trash2,
  X,
} from "lucide-react";
import { fetcher, fmtRelative, statusPillClass } from "@/components/asset-studio/lib";
import type { AuditLogEvent, Variant, VariantRun, VariantStatus } from "@/types/domain";

const ALLOWED_ROLES = ["Admin", "Producer", "Post Producer", "Designer", "Art Director"];

type RouteParams = { id: string };

export default function RunDetailPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { id } = use(params);
  const { user, isLoading: userLoading } = useCurrentUser();
  const { toast } = useToast();

  const url = `/api/asset-studio/runs/${id}`;
  const { data: run, isLoading } = useSWR<VariantRun>(url, fetcher, {
    // Auto-refresh while a render is in flight so the gallery fills in live.
    refreshInterval: (latest) =>
      latest && (latest.status === "queued" || latest.status === "rendering")
        ? 3000
        : 0,
  });

  const [statusFilter, setStatusFilter] = useState<"" | VariantStatus>("");
  const [acting, setActing] = useState<string | null>(null);

  // Memoize variants & counts — hooks must run unconditionally, so we derive
  // from the possibly-undefined `run` and bail on the value later.
  const variants = useMemo<Variant[]>(() => run?.variants ?? [], [run?.variants]);
  const counts = useMemo(() => {
    const c: Record<VariantStatus, number> = {
      pending: 0,
      rendering: 0,
      rendered: 0,
      approved: 0,
      rejected: 0,
      failed: 0,
    };
    for (const v of variants) c[v.status] = (c[v.status] ?? 0) + 1;
    return c;
  }, [variants]);

  // ── Guards ───────────────────────────────────────────────────────────────
  if (userLoading || !user || isLoading) return <DashboardSkeleton />;
  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <EmptyState
        title="Access restricted"
        description="Asset Studio runs are visible to Designers, Producers, Post Producers, Art Directors, and Admins."
      />
    );
  }
  if (!run) {
    return (
      <EmptyState
        title="Run not found"
        description="It may have been deleted, or you don't have access to it."
      />
    );
  }

  const canControl = ["Admin", "Producer", "Post Producer", "Designer"].includes(
    user.role
  );
  const canApprove = ["Admin", "Producer", "Post Producer", "Art Director"].includes(user.role);

  const filtered = statusFilter
    ? variants.filter((v) => v.status === statusFilter)
    : variants;

  const pct =
    run.totalVariants > 0
      ? Math.round((run.completedVariants / run.totalVariants) * 100)
      : 0;

  // ── Actions ──────────────────────────────────────────────────────────────
  async function callAction(
    name: string,
    fn: () => Promise<Response>,
    successMsg: string
  ) {
    setActing(name);
    try {
      const res = await fn();
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Action "${name}" failed`);
      }
      toast("success", successMsg);
      await mutate(url);
    } catch (err) {
      console.error(err);
      toast("error", (err as Error).message ?? "Action failed");
    } finally {
      setActing(null);
    }
  }

  const onRender = () =>
    callAction(
      "render",
      () => fetch(`/api/asset-studio/runs/${id}/render`, { method: "POST" }),
      "Render started"
    );

  const onRefresh = () =>
    callAction(
      "refresh",
      () => fetch(`/api/asset-studio/runs/${id}/refresh`, { method: "POST" }),
      "Counts refreshed"
    );

  const onCancel = () => {
    if (!window.confirm("Cancel this run? Pending variants will be marked failed."))
      return;
    return callAction(
      "cancel",
      () =>
        fetch(`/api/asset-studio/runs/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel" }),
        }),
      "Run cancelled"
    );
  };

  const onDelete = () => {
    if (
      !window.confirm(
        "Delete this run and all its variants? This cannot be undone."
      )
    )
      return;
    return callAction(
      "delete",
      () => fetch(`/api/asset-studio/runs/${id}`, { method: "DELETE" }),
      "Run deleted"
    ).then(() => {
      window.location.href = "/asset-studio?tab=runs";
    });
  };

  async function bulkApprove() {
    const ids = filtered
      .filter((v) => v.status === "rendered")
      .map((v) => v.id);
    if (ids.length === 0) {
      toast("info", "Nothing to approve in this view.");
      return;
    }
    await callAction(
      "bulk-approve",
      () =>
        fetch("/api/asset-studio/variants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, action: "approve" }),
        }),
      `${ids.length} variant${ids.length === 1 ? "" : "s"} approved`
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5" data-area="asset-studio">
      <div>
        <Link
          href="/asset-studio?tab=runs"
          className="mb-1 inline-flex items-center gap-1 text-xs text-[var(--as-text-muted)] hover:text-[var(--as-text)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to runs
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-bold text-[var(--as-text)]">
                {run.name}
              </h1>
              <span className={statusPillClass(run.status)}>{run.status}</span>
            </div>
            <p className="mt-0.5 text-sm text-[var(--as-text-muted)]">
              {run.template?.name ? `${run.template.name} · ` : ""}
              {run.campaign?.wfNumber ? `${run.campaign.wfNumber} · ` : ""}
              Created {fmtRelative(run.createdAt)}
              {run.startedAt ? ` · started ${fmtRelative(run.startedAt)}` : ""}
              {run.completedAt
                ? ` · completed ${fmtRelative(run.completedAt)}`
                : ""}
            </p>
            {run.notes && (
              <p className="mt-1 text-xs text-[var(--as-text-subtle)]">
                Note: {run.notes}
              </p>
            )}
          </div>
          {canControl && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                loading={acting === "refresh"}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              {(() => {
                const approvedCount = counts.approved;
                const renderedCount = counts.rendered;
                const zipStatus = approvedCount > 0 ? "approved" : "rendered";
                const zipCount = approvedCount > 0 ? approvedCount : renderedCount;
                if (zipCount === 0) return null;
                return (
                  <a
                    href={`/api/asset-studio/runs/${id}/zip?status=${zipStatus}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--as-border)] bg-[var(--as-surface)] px-3 py-1.5 text-xs font-medium text-[var(--as-text)] hover:bg-[var(--as-surface-2)]"
                  >
                    <Download className="h-4 w-4" />
                    Download zip ({zipCount} {zipStatus})
                  </a>
                );
              })()}
              {(run.status === "queued" || run.status === "failed") && (
                <Button
                  size="sm"
                  onClick={onRender}
                  loading={acting === "render"}
                >
                  <PlayCircle className="h-4 w-4" />
                  Render now
                </Button>
              )}
              {run.status === "rendering" && (
                <Button size="sm" disabled loading>
                  Rendering…
                </Button>
              )}
              {(run.status === "queued" || run.status === "rendering") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCancel}
                  loading={acting === "cancel"}
                >
                  <StopCircle className="h-4 w-4" />
                  Cancel
                </Button>
              )}
              {user.role === "Admin" && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={onDelete}
                  loading={acting === "delete"}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress + counts */}
      <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--as-text)]">
              {run.completedVariants} / {run.totalVariants} rendered
              {run.failedVariants > 0 ? ` · ${run.failedVariants} failed` : ""}
            </p>
            <p className="text-xs text-[var(--as-text-subtle)]">
              {pct}% complete
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            <CountChip label="Pending" n={counts.pending} />
            <CountChip label="Rendering" n={counts.rendering} />
            <CountChip label="Rendered" n={counts.rendered} />
            <CountChip label="Approved" n={counts.approved} />
            <CountChip label="Rejected" n={counts.rejected} />
            <CountChip label="Failed" n={counts.failed} />
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--as-surface-2)]">
          <div
            className="h-full bg-[var(--as-accent)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </Card>

      {/* Filter + variant gallery */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-1">
          {(
            [
              { v: "", l: "All" },
              { v: "rendered", l: "Pending review" },
              { v: "approved", l: "Approved" },
              { v: "rejected", l: "Rejected" },
              { v: "failed", l: "Failed" },
            ] as Array<{ v: "" | VariantStatus; l: string }>
          ).map((opt) => (
            <button
              key={opt.v || "all"}
              onClick={() => setStatusFilter(opt.v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === opt.v
                  ? "bg-[var(--as-accent-soft)] text-[var(--as-accent)]"
                  : "text-[var(--as-text-muted)] hover:bg-[var(--as-surface-2)]"
              }`}
            >
              {opt.l}
            </button>
          ))}
        </div>
        {canApprove && filtered.some((v) => v.status === "rendered") && (
          <Button size="sm" onClick={bulkApprove} loading={acting === "bulk-approve"}>
            <Check className="h-3.5 w-3.5" />
            Approve all rendered
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
          <EmptyState
            title={statusFilter ? "No matching variants" : "No variants yet"}
            description={
              statusFilter
                ? "Try clearing the status filter."
                : run.status === "queued"
                  ? "Click 'Render now' to start the render pipeline."
                  : "Variants will appear here as they render."
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((v) => (
            <RunVariantCard
              key={v.id}
              variant={v}
              canApprove={canApprove}
              onAction={async (action) => {
                if (action === "approve") {
                  await fetch(`/api/asset-studio/variants/${v.id}/approve`, {
                    method: "POST",
                  });
                } else {
                  const reason = window.prompt("Reason (optional)") ?? "";
                  await fetch(`/api/asset-studio/variants/${v.id}/reject`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reason }),
                  });
                }
                mutate(url);
                // Kick the audit-log feed so the new event appears without a reload.
                mutate(`/api/asset-studio/runs/${id}/audit-log`);
              }}
            />
          ))}
        </div>
      )}

      <AuditLogFeed runId={id} />
    </div>
  );
}

function AuditLogFeed({ runId }: { runId: string }) {
  const { data: events } = useSWR<AuditLogEvent[]>(
    `/api/asset-studio/runs/${runId}/audit-log`,
    fetcher,
    { refreshInterval: 10000 }
  );
  if (!events || events.length === 0) return null;
  return (
    <Card padding="none" className="border-[var(--as-border)] bg-[var(--as-surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--as-border)] px-3.5 py-2.5">
        <RefreshCw className="h-4 w-4 shrink-0 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--as-text)]">
          Audit log
        </h3>
        <span className="ml-auto text-[11px] text-[var(--as-text-subtle)]">
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="max-h-72 overflow-y-auto divide-y divide-[var(--as-border)] text-xs">
        {events.map((e) => (
          <li key={e.id} className="flex items-start gap-3 px-3.5 py-2">
            <span className="w-20 shrink-0 text-[var(--as-text-subtle)]">
              {fmtRelative(e.createdAt)}
            </span>
            <span className="w-28 shrink-0 font-medium text-[var(--as-text)]">
              {e.actorName ?? (e.actorRole === "system" ? "System" : "—")}
              {e.actorRole && e.actorRole !== "system" && (
                <span className="ml-1 text-[10px] text-[var(--as-text-subtle)]">
                  ({e.actorRole})
                </span>
              )}
            </span>
            <span className="flex-1 text-[var(--as-text-muted)]">
              <AuditActionLabel action={e.action} targetType={e.targetType} />
              {e.reason && (
                <span className="ml-1 text-[var(--as-text-subtle)]">
                  — “{e.reason}”
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AuditActionLabel({
  action,
  targetType,
}: {
  action: string;
  targetType: string;
}) {
  const map: Record<string, string> = {
    approved: "approved a variant",
    rejected: "rejected a variant",
    bulk_approved: "bulk-approved variants",
    bulk_rejected: "bulk-rejected variants",
    created: targetType === "variant_run" ? "created this run" : "created",
    completed: "run completed",
    failed: "run failed",
    published: "published template",
    version_saved: "saved a new template version",
    version_restored: "restored a prior template version",
  };
  return <span>{map[action] ?? action}</span>;
}

function CountChip({ label, n }: { label: string; n: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-[var(--as-surface-2)] px-2 py-0.5 text-[11px] font-medium ${
        n > 0 ? "text-[var(--as-text)]" : "text-[var(--as-text-subtle)]"
      }`}
    >
      <span>{label}</span>
      <span className="rounded-full bg-[var(--as-surface)] px-1.5 text-[10px]">
        {n}
      </span>
    </span>
  );
}

function RunVariantCard({
  variant,
  canApprove,
  onAction,
}: {
  variant: Variant;
  canApprove: boolean;
  onAction: (action: "approve" | "reject") => Promise<void>;
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-[var(--as-border)] bg-[var(--as-surface)] transition-all hover:shadow-md">
      <div className="relative aspect-square bg-[var(--as-canvas-bg)]">
        {variant.assetUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={variant.thumbnailUrl ?? variant.assetUrl}
            alt={variant.product?.name ?? "Variant"}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--as-text-subtle)]">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
        <span className={`absolute right-2 top-2 ${statusPillClass(variant.status)}`}>
          {variant.status}
        </span>
        {variant.localeCode && variant.localeCode !== "en-US" && (
          <span
            className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-white"
            title={`Locale: ${variant.localeCode}`}
          >
            {variant.localeCode}
          </span>
        )}
      </div>

      <div className="p-2.5">
        <p className="truncate text-xs font-medium text-[var(--as-text)]">
          {variant.product?.name || "Variant"}
        </p>
        <p className="truncate text-[11px] text-[var(--as-text-subtle)]">
          {variant.outputSpec?.label ?? `${variant.width}×${variant.height}`}
          {variant.localeCode && variant.localeCode !== "en-US" && (
            <> · <span className="font-mono">{variant.localeCode}</span></>
          )}
        </p>

        {variant.errorMessage && variant.status === "failed" && (
          <p className="mt-1 truncate text-[11px] text-[var(--as-status-failed)]" title={variant.errorMessage}>
            {variant.errorMessage}
          </p>
        )}

        {canApprove &&
          variant.status !== "approved" &&
          variant.status !== "rejected" &&
          variant.status === "rendered" && (
            <div className="mt-2 flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onAction("reject")}
                aria-label="Reject"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => onAction("approve")}
                aria-label="Approve"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

        {variant.assetUrl && variant.status === "approved" && (
          <a
            href={variant.assetUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block text-center text-[11px] font-medium text-[var(--as-accent)] hover:underline"
          >
            Download
          </a>
        )}
      </div>
    </div>
  );
}
