"use client";

import Link from "next/link";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { AppUser, AssetStudioSummary } from "@/types/domain";
import { fetcher, statusPillClass, fmtRelative } from "./lib";
import {
  FileImage,
  CheckCircle2,
  Images,
  Sparkles,
  PlayCircle,
  Clock,
  ArrowUpRight,
} from "lucide-react";

interface Props {
  user: AppUser;
}

export function OverviewTab({ user }: Props) {
  const { data, isLoading, error } = useSWR<AssetStudioSummary>(
    "/api/asset-studio/summary",
    fetcher
  );

  const canCreate = ["Admin", "Producer", "Post Producer", "Designer"].includes(user.role);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-[var(--as-border)] bg-[var(--as-surface)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Couldn't load Asset Studio"
        description="Try reloading the page. If the problem persists, contact the admin."
      />
    );
  }

  const stats = [
    {
      label: "Templates",
      value: data.templateCount,
      sub: `${data.publishedTemplateCount} published`,
      icon: FileImage,
    },
    {
      label: "Active runs",
      value: data.activeRunCount,
      sub: "Queued or rendering",
      icon: PlayCircle,
    },
    {
      label: "Variants this week",
      value: data.variantsThisWeek,
      sub: "Rendered in the last 7 days",
      icon: Images,
    },
    {
      label: "Pending approval",
      value: data.pendingApprovalCount,
      sub: `${data.approvedCount} approved total`,
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Hero / CTA */}
      <Card padding="lg" className="flex flex-col gap-3 border-[var(--as-border)] bg-[var(--as-surface)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-[var(--as-accent-soft)] p-2">
            <Sparkles className="h-5 w-5 text-[var(--as-accent)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--as-text)]">
              Asset Studio
            </h2>
            <p className="text-sm text-[var(--as-text-muted)]">
              Build a template once. Render dozens of on-brand variants per campaign in minutes.
            </p>
          </div>
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2">
            <Link href="/asset-studio?tab=templates">
              <Button variant="outline" size="sm">Browse templates</Button>
            </Link>
            <Link href="/asset-studio/runs/new">
              <Button variant="primary" size="sm">
                New run
              </Button>
            </Link>
          </div>
        )}
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card
              key={s.label}
              padding="md"
              className="border-[var(--as-border)] bg-[var(--as-surface)]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--as-text-muted)]">
                    {s.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--as-text)]">
                    {s.value.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-[var(--as-text-subtle)]">{s.sub}</p>
                </div>
                <div className="rounded-md bg-[var(--as-surface-2)] p-1.5">
                  <Icon className="h-4 w-4 text-[var(--as-text-muted)]" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Recent runs */}
      <Card padding="none" className="border-[var(--as-border)] bg-[var(--as-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--as-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--as-text-muted)]" />
            <h3 className="text-sm font-semibold text-[var(--as-text)]">Recent runs</h3>
          </div>
          <Link
            href="/asset-studio?tab=runs"
            className="text-xs font-medium text-[var(--as-accent)] hover:text-[var(--as-accent-hover)]"
          >
            View all
          </Link>
        </div>

        {data.recentRuns.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--as-text-muted)]">
            No runs yet. Create a template and kick off your first run.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--as-border)]">
            {data.recentRuns.map((run) => {
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
                        {run.campaign?.wfNumber ? `${run.campaign.wfNumber} · ` : ""}
                        {run.completedVariants}/{run.totalVariants} variants · {fmtRelative(run.createdAt)}
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
        )}
      </Card>
    </div>
  );
}
