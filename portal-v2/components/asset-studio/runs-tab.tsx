"use client";

import Link from "next/link";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { AppUser, VariantRun, VariantRunStatus } from "@/types/domain";
import { fetcher, statusPillClass, fmtRelative } from "./lib";
import { Plus, ArrowUpRight } from "lucide-react";
import { useState } from "react";

interface Props {
  user: AppUser;
  // When set, filter runs to just this campaign (used by /campaigns/[id]/asset-studio).
  campaignId?: string;
}

const STATUS_OPTIONS: Array<{ value: "" | VariantRunStatus; label: string }> = [
  { value: "", label: "All" },
  { value: "queued", label: "Queued" },
  { value: "rendering", label: "Rendering" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

export function RunsTab({ user, campaignId }: Props) {
  const [status, setStatus] = useState<"" | VariantRunStatus>("");
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (campaignId) params.set("campaignId", campaignId);
  const qs = params.toString();
  const url = `/api/asset-studio/runs${qs ? `?${qs}` : ""}`;
  const { data, isLoading } = useSWR<VariantRun[]>(url, fetcher);

  const canCreate = ["Admin", "Producer", "Post Producer", "Designer"].includes(user.role);
  const newRunHref = campaignId
    ? `/asset-studio/runs/new?campaignId=${campaignId}`
    : "/asset-studio/runs/new";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value || "all"}
              onClick={() => setStatus(opt.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                status === opt.value
                  ? "bg-[var(--as-accent-soft)] text-[var(--as-accent)]"
                  : "text-[var(--as-text-muted)] hover:bg-[var(--as-surface-2)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {canCreate && (
          <Link href={newRunHref}>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New run
            </Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-lg border border-[var(--as-border)] bg-[var(--as-surface)] animate-pulse"
            />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
          <EmptyState
            title={status ? "No matching runs" : "No runs yet"}
            description={
              status
                ? "Try clearing the status filter."
                : canCreate
                  ? "Kick off your first run to render variants from a template."
                  : "Runs will appear here once a producer creates one."
            }
            action={
              canCreate && !status ? (
                <Link href="/asset-studio/runs/new">
                  <Button size="sm">
                    <Plus className="h-4 w-4" />
                    New run
                  </Button>
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card padding="none" className="border-[var(--as-border)] bg-[var(--as-surface)]">
          <ul className="divide-y divide-[var(--as-border)]">
            {data.map((run) => {
              const pct =
                run.totalVariants > 0
                  ? Math.round((run.completedVariants / run.totalVariants) * 100)
                  : 0;
              return (
                <li key={run.id}>
                  <Link
                    href={`/asset-studio/runs/${run.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--as-layer-hover)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-[var(--as-text)]">
                          {run.name}
                        </span>
                        <span className={statusPillClass(run.status)}>{run.status}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--as-text-muted)]">
                        {run.campaign?.wfNumber ? `${run.campaign.wfNumber} ` : ""}
                        {run.completedVariants}/{run.totalVariants} variants
                        {run.failedVariants > 0
                          ? ` · ${run.failedVariants} failed`
                          : ""}
                        {" · "}
                        {fmtRelative(run.createdAt)}
                      </p>
                    </div>
                    <div className="hidden w-32 shrink-0 sm:block">
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--as-surface-2)]">
                        <div
                          className="h-full bg-[var(--as-accent)] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-right text-xs text-[var(--as-text-subtle)]">
                        {pct}%
                      </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--as-text-subtle)]" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
