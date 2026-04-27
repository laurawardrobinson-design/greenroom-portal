"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import useSWR, { mutate } from "swr";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useToast } from "@/components/ui/toast";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
  ImageOff,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  StopCircle,
  Trash2,
  X,
} from "lucide-react";
import { fetcher, fmtRelative, statusPillClass } from "@/components/asset-studio/lib";
import type {
  AuditLogEvent,
  RenderJob,
  Variant,
  VariantRun,
  VariantStatus,
} from "@/types/domain";

const ALLOWED_ROLES = ["Admin", "Producer", "Post Producer", "Designer", "Art Director", "Creative Director"];

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
  const renderJobsUrl = `/api/asset-studio/runs/${id}/render-jobs?limit=1`;
  const { data: renderJobs } = useSWR<RenderJob[]>(renderJobsUrl, fetcher, {
    refreshInterval: (latest) =>
      latest?.[0] &&
      (latest[0].status === "queued" || latest[0].status === "processing")
        ? 2000
        : 0,
  });

  const [statusFilter, setStatusFilter] = useState<"" | VariantStatus>("");
  const [acting, setActing] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const latestRenderJob = renderJobs?.[0] ?? null;

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
        description="Asset Studio runs are visible to Designers, Producers, Post Producers, Art Directors, Creative Directors, and Admins."
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
  const canApprove = ["Admin", "Creative Director"].includes(user.role);

  const filtered = statusFilter
    ? variants.filter((v) => v.status === statusFilter)
    : variants;

  const pct =
    run.totalVariants > 0
      ? Math.round((run.completedVariants / run.totalVariants) * 100)
      : 0;
  const jobPct =
    latestRenderJob && latestRenderJob.progress.total > 0
      ? Math.round(
          (latestRenderJob.progress.done / latestRenderJob.progress.total) * 100
        )
      : latestRenderJob?.status === "completed"
        ? 100
        : 0;

  // ── Actions ──────────────────────────────────────────────────────────────
  async function callAction(
    name: string,
    fn: () => Promise<Response>,
    successMsg: string
  ): Promise<boolean> {
    setActing(name);
    try {
      const res = await fn();
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Action "${name}" failed`);
      }
      toast("success", successMsg);
      await mutate(url);
      await mutate(renderJobsUrl);
      return true;
    } catch (err) {
      console.error(err);
      toast("error", (err as Error).message ?? "Action failed");
      return false;
    } finally {
      setActing(null);
    }
  }

  const onRender = () =>
    callAction(
      "render",
      () => fetch(`/api/asset-studio/runs/${id}/render`, { method: "POST" }),
      "Render queued"
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
    ).then((ok) => {
      if (ok) window.location.href = "/asset-studio?tab=runs";
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
    setActing("bulk-approve");
    try {
      const res = await fetch("/api/asset-studio/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action: "approve" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Bulk approval failed");
      }
      const body = (await res.json()) as { updated: number; skipped?: number };
      const skipped = body.skipped ?? 0;
      toast(
        "success",
        `${body.updated} variant${body.updated === 1 ? "" : "s"} approved${
          skipped > 0 ? ` · ${skipped} skipped` : ""
        }`
      );
      await mutate(url);
      await mutate(renderJobsUrl);
    } catch (error) {
      console.error(error);
      toast("error", (error as Error).message ?? "Action failed");
    } finally {
      setActing(null);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" data-area="asset-studio">
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
              {run.campaign?.wfNumber ? `${run.campaign.wfNumber} ` : ""}
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
        {latestRenderJob && (
          <div className="mt-3 rounded-md border border-[var(--as-border)] bg-[var(--as-surface-2)] p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[var(--as-text)]">
                Latest render job{" "}
                <span className="text-[11px] text-[var(--as-text-subtle)]">
                  {latestRenderJob.id.slice(0, 8)}
                </span>
              </p>
              <span className={renderJobStatusPillClass(latestRenderJob.status)}>
                {latestRenderJob.status}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--as-text-subtle)]">
              {latestRenderJob.progress.done} / {latestRenderJob.progress.total} complete
              {latestRenderJob.progress.failed > 0
                ? ` · ${latestRenderJob.progress.failed} failed`
                : ""}
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--as-surface)]">
              <div
                className={`h-full transition-all ${
                  latestRenderJob.progress.failed > 0
                    ? "bg-[var(--as-status-failed)]"
                    : "bg-[var(--as-accent)]"
                }`}
                style={{ width: `${jobPct}%` }}
              />
            </div>
          </div>
        )}
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
          {filtered.map((v, i) => (
            <RunVariantCard
              key={v.id}
              variant={v}
              canApprove={canApprove}
              canControl={canControl}
              onOpen={() => setLightboxIndex(i)}
              onRetry={async () => {
                try {
                  const reset = await fetch(`/api/asset-studio/variants/${v.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "pending", errorMessage: null }),
                  });
                  if (!reset.ok) {
                    const body = await reset.json().catch(() => ({}));
                    throw new Error(body.error ?? "Couldn't reset variant");
                  }
                  const res = await fetch(`/api/asset-studio/runs/${id}/render`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                  });
                  if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body.error ?? "Couldn't queue retry");
                  }
                  toast("success", "Retry queued");
                  mutate(url);
                  mutate(`/api/asset-studio/runs/${id}/audit-log`);
                } catch (error) {
                  toast("error", (error as Error).message ?? "Retry failed");
                }
              }}
              onDelete={async () => {
                if (!window.confirm("Remove this failed variant? This cannot be undone."))
                  return;
                try {
                  const res = await fetch(`/api/asset-studio/variants/${v.id}`, {
                    method: "DELETE",
                  });
                  if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body.error ?? "Couldn't remove variant");
                  }
                  toast("success", "Variant removed");
                  mutate(url);
                  mutate(`/api/asset-studio/runs/${id}/audit-log`);
                } catch (error) {
                  toast("error", (error as Error).message ?? "Remove failed");
                }
              }}
              onAction={async (action) => {
                try {
                  let res: Response;
                  if (action === "approve") {
                    res = await fetch(`/api/asset-studio/variants/${v.id}/approve`, {
                      method: "POST",
                    });
                  } else {
                    const reason = window.prompt("Reason (optional)") ?? "";
                    res = await fetch(`/api/asset-studio/variants/${v.id}/reject`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ reason }),
                    });
                  }
                  if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body.error ?? `Couldn't ${action} variant`);
                  }
                  toast(
                    action === "approve" ? "success" : "info",
                    `Variant ${action}d`
                  );
                } catch (error) {
                  toast("error", (error as Error).message ?? "Action failed");
                } finally {
                  mutate(url);
                  // Kick the audit-log feed so the new event appears without a reload.
                  mutate(`/api/asset-studio/runs/${id}/audit-log`);
                }
              }}
            />
          ))}
        </div>
      )}

      <AuditLogFeed runId={id} />

      {lightboxIndex !== null && filtered[lightboxIndex] && (
        <VariantLightbox
          variants={filtered}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </div>
  );
}

function VariantLightbox({
  variants,
  index,
  onClose,
  onIndexChange,
}: {
  variants: Variant[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const variant = variants[index];
  const canPrev = index > 0;
  const canNext = index < variants.length - 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && canPrev) onIndexChange(index - 1);
      else if (e.key === "ArrowRight" && canNext) onIndexChange(index + 1);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, canPrev, canNext, onClose, onIndexChange]);

  if (!variant.assetUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${variant.product?.name ?? "Variant"} preview`}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
        aria-label="Close preview"
      >
        <X className="h-5 w-5" />
      </button>

      {canPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange(index - 1);
          }}
          className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
          aria-label="Previous variant"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {canNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange(index + 1);
          }}
          className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
          aria-label="Next variant"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      <div
        className="relative flex max-h-full max-w-5xl flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex max-h-[80vh] max-w-full items-center justify-center rounded-lg bg-white">
          <Image
            src={`${variant.assetUrl}?v=${encodeURIComponent(variant.updatedAt)}`}
            alt={variant.product?.name ?? "Variant"}
            width={variant.width || 1200}
            height={variant.height || 1200}
            sizes="(max-width: 1024px) 90vw, 1024px"
            className="max-h-[80vh] w-auto rounded-lg object-contain"
            priority
          />
          <span className={`absolute right-3 top-3 ${statusPillClass(variant.status)}`}>
            {variant.status}
          </span>
        </div>
        <div className="text-center text-white">
          <p className="text-sm font-medium">{variant.product?.name ?? "Variant"}</p>
          <p className="mt-0.5 text-xs text-white/60">
            {variant.outputSpec?.label ?? `${variant.width}\u00d7${variant.height}`}
            {" \u00b7 "}
            {index + 1} of {variants.length}
          </p>
        </div>
      </div>
    </div>
  );
}

function AuditLogFeed({ runId }: { runId: string }) {
  const { data: events } = useSWR<AuditLogEvent[]>(
    `/api/asset-studio/runs/${runId}/audit-log`,
    fetcher,
    {
      refreshInterval: 3000,
      revalidateOnFocus: true,
      revalidateOnMount: true,
    }
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
    rendered: "queued a render job",
    completed: "run completed",
    failed: "run failed",
    cancelled: "run cancelled",
    published: "published template",
    version_saved: "saved a new template version",
    version_restored: "restored a prior template version",
  };
  return <span>{map[action] ?? action}</span>;
}

function renderJobStatusPillClass(status: RenderJob["status"]): string {
  if (status === "queued") return statusPillClass("queued");
  if (status === "processing") return statusPillClass("rendering");
  if (status === "completed") return statusPillClass("completed");
  if (status === "failed") return statusPillClass("failed");
  return "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--as-surface-2)] text-[var(--as-text-muted)]";
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
  canControl,
  onAction,
  onOpen,
  onRetry,
  onDelete,
}: {
  variant: Variant;
  canApprove: boolean;
  canControl: boolean;
  onAction: (action: "approve" | "reject") => Promise<void>;
  onOpen: () => void;
  onRetry: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-[var(--as-border)] bg-[var(--as-surface)] transition-all hover:shadow-md">
      <div className={`relative aspect-square ${variant.status === "failed" ? "bg-[color-mix(in_srgb,var(--as-status-failed)_8%,white)]" : "bg-white"}`}>
        {variant.assetUrl ? (
          <button
            type="button"
            onClick={onOpen}
            className="absolute inset-0 block cursor-zoom-in"
            aria-label={`Review ${variant.product?.name ?? "variant"} full size`}
          >
            <Image
              src={`${variant.thumbnailUrl ?? variant.assetUrl}?v=${encodeURIComponent(variant.updatedAt)}`}
              alt={variant.product?.name ?? "Variant"}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 240px"
              className="object-contain"
              loading="lazy"
            />
          </button>
        ) : variant.status === "failed" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center">
            <ImageOff className="h-6 w-6 text-[var(--as-status-failed)]" />
            <p className="text-[11px] leading-snug text-[var(--as-status-failed)]">
              {variant.errorMessage ?? "Render failed"}
            </p>
          </div>
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
            className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white"
            title={`Locale: ${variant.localeCode}`}
          >
            {variant.localeCode}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-2.5">
        <p className="truncate text-xs font-medium text-[var(--as-text)]">
          {variant.product?.name || "Variant"}
        </p>
        <p className="truncate text-[11px] text-[var(--as-text-subtle)]">
          {variant.outputSpec?.label ?? `${variant.width}×${variant.height}`}
          {variant.localeCode && variant.localeCode !== "en-US" && (
            <> · <span>{variant.localeCode}</span></>
          )}
        </p>

        {canApprove && variant.status === "rendered" && (
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

        {canControl && variant.status === "failed" && (
          <div className="mt-2 flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onDelete}
              aria-label="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={onRetry}
              aria-label="Retry"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
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
