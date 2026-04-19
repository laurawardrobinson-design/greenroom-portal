"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import type { AppUser, MyWorkQueueItem, WorkflowTransition } from "@/types/domain";
import { fetcher, fmtRelative, statusPillClass } from "./lib";
import { CircleCheckBig, ListChecks } from "lucide-react";

interface Props {
  user: AppUser;
}

interface MyWorkQueueResponse {
  items: MyWorkQueueItem[];
}

function actionButtonVariant(transition: WorkflowTransition): "primary" | "outline" | "danger" {
  if (transition.kind === "reject") return "danger";
  if (transition.kind === "return") return "outline";
  return "primary";
}

export function MyWorkTab({ user }: Props) {
  const { toast } = useToast();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const { data, isLoading, error, mutate } = useSWR<MyWorkQueueResponse>(
    "/api/asset-studio/workflows/my-work?limit=100",
    fetcher
  );

  const stageSummary = useMemo(() => {
    const queueItems = data?.items ?? [];
    const counts = new Map<string, number>();
    for (const item of queueItems) {
      counts.set(item.currentStage, (counts.get(item.currentStage) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [data?.items]);

  const items = data?.items ?? [];

  async function runTransition(item: MyWorkQueueItem, transition: WorkflowTransition) {
    const busyId = `${item.workflowInstanceId}:${transition.action}`;
    setBusyKey(busyId);

    try {
      const res = await fetch(
        `/api/asset-studio/workflows/${item.entityType}/${item.entityId}/advance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: transition.action,
            reason: `Actioned from My Work by ${user.role}`,
            metadata: {
              source: "asset-studio.my-work-tab",
            },
          }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not advance workflow");
      }

      toast("success", transition.label);
      await mutate();
    } catch (err) {
      console.error(err);
      toast("error", (err as Error).message || "Workflow action failed");
    } finally {
      setBusyKey(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-[var(--as-border)] bg-[var(--as-surface)]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Couldn’t load My Work"
        description="Try reloading the page. If the issue persists, contact an admin."
      />
    );
  }

  return (
    <div className="space-y-5">
      <Card
        padding="lg"
        className="flex flex-col gap-3 border-[var(--as-border)] bg-[var(--as-surface)] lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-[var(--as-accent-soft)] p-2">
            <ListChecks className="h-5 w-5 text-[var(--as-accent)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--as-text)]">My Work</h2>
            <p className="text-sm text-[var(--as-text-muted)]">
              Role-based DAM workflow handoffs for {user.role}. Actions are validated server-side.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3 lg:grid-cols-4">
          <StageStat label="Actionable" value={items.length} />
          {stageSummary.map(([stage, count]) => (
            <StageStat
              key={stage}
              label={stage.replaceAll("_", " ")}
              value={count}
            />
          ))}
        </div>
      </Card>

      {items.length === 0 ? (
        <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
          <EmptyState
            title="No actionable items"
            description="New DAM lifecycle handoffs will appear here when your role can move the current stage."
          />
        </Card>
      ) : (
        <Card padding="none" className="border-[var(--as-border)] bg-[var(--as-surface)]">
          <ul className="divide-y divide-[var(--as-border)]">
            {items.map((item) => (
              <li key={item.workflowInstanceId} className="px-4 py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-[var(--as-text)]">
                        {item.asset.name}
                      </span>
                      <span className={statusPillClass(item.currentStage)}>
                        {item.currentStage.replaceAll("_", " ")}
                      </span>
                      <span className={statusPillClass(item.asset.syncStatus)}>
                        Sync: {item.asset.syncStatus.replaceAll("_", " ")}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-[var(--as-text-muted)]">
                      {item.campaign
                        ? `${item.campaign.wfNumber ? `${item.campaign.wfNumber} · ` : ""}${item.campaign.name}`
                        : "No campaign linked"}
                      {" · "}
                      Updated {fmtRelative(item.updatedAt)}
                    </p>

                    {item.stageQueueRoles.length > 0 && (
                      <p className="mt-1 text-[11px] text-[var(--as-text-subtle)]">
                        Stage roles: {item.stageQueueRoles.join(", ")}
                      </p>
                    )}

                    {item.recentEvents.length > 0 && (
                      <div className="mt-2 space-y-1 rounded-md border border-[var(--as-border)] bg-[var(--as-surface-2)] p-2">
                        {item.recentEvents.slice(0, 3).map((event) => (
                          <div key={event.id} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="truncate text-[var(--as-text)]">
                              {event.action.replaceAll("_", " ")}
                              {event.fromStage ? `: ${event.fromStage} -> ${event.toStage}` : `: ${event.toStage}`}
                            </span>
                            <span className="text-[var(--as-text-subtle)]">
                              {fmtRelative(event.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
                    {item.availableTransitions.map((transition) => {
                      const busyId = `${item.workflowInstanceId}:${transition.action}`;
                      return (
                        <Button
                          key={transition.action}
                          size="sm"
                          variant={actionButtonVariant(transition)}
                          loading={busyKey === busyId}
                          onClick={() => runTransition(item, transition)}
                        >
                          <CircleCheckBig className="h-3.5 w-3.5" />
                          {transition.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function StageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--as-border)] bg-[var(--as-surface-2)] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-[var(--as-text-muted)]">{label}</p>
      <p className="text-lg font-semibold text-[var(--as-text)]">{value.toLocaleString()}</p>
    </div>
  );
}
