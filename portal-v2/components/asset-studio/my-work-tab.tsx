"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";
import type {
  AppUser,
  AssetStudioSummary,
  Campaign,
  MyWorkQueueItem,
  WorkflowTransition,
} from "@/types/domain";
import { fetcher, fmtRelative, statusPillClass } from "./lib";
import {
  CircleCheckBig,
  ListChecks,
  Palette,
  Wand2,
  PencilLine,
  FileImage,
  PlayCircle,
  Images,
  CheckCircle2,
} from "lucide-react";

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
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const { data, isLoading, error, mutate } = useSWR<MyWorkQueueResponse>(
    "/api/asset-studio/workflows/my-work?limit=100",
    fetcher
  );

  const { data: myCampaignsData } = useSWR<{ items: Array<{ campaign: Campaign; roles: string[] }> }>(
    "/api/campaigns/mine",
    fetcher
  );
  const myCampaigns = myCampaignsData?.items ?? [];

  const { data: summary } = useSWR<AssetStudioSummary>(
    "/api/asset-studio/summary",
    fetcher
  );

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

  // Special path for the first transition on a deliverable: create the
  // template (prefilled from the deliverable's channel/format/dimensions),
  // advance the workflow to drafting, and jump into the editor.
  async function startTemplatingForDeliverable(item: MyWorkQueueItem) {
    if (item.entityType !== "deliverable" || !item.deliverable) return;
    const busyId = `${item.workflowInstanceId}:start_drafting`;
    setBusyKey(busyId);

    try {
      const res = await fetch("/api/asset-studio/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliverableId: item.deliverable.id,
          seedDefaultSpecs: true,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not start templating");
      }

      const template = await res.json();
      toast("success", "Template created — opening editor");
      router.push(`/asset-studio/templates/${template.id}/edit`);
    } catch (err) {
      console.error(err);
      toast("error", (err as Error).message || "Failed to start templating");
      setBusyKey(null);
    }
  }

  function renderAssetRow(item: MyWorkQueueItem) {
    if (!item.asset) return null;
    return (
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
    );
  }

  function renderDeliverableRow(item: MyWorkQueueItem) {
    const d = item.deliverable;
    if (!d) return null;

    const sizeLabel = d.width && d.height ? `${d.width}×${d.height}` : d.aspectRatio;
    const channelFormat = [d.channel, d.format].filter(Boolean).join(" ") || "Deliverable";
    const quantityLabel = d.quantity > 1 ? ` · ${d.quantity} variants` : "";

    return (
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-[var(--as-text)]">
              {channelFormat}
              {sizeLabel ? (
                <span className="ml-1 font-normal text-[var(--as-text-muted)]">
                  {sizeLabel}
                </span>
              ) : null}
            </span>
            <span className={statusPillClass(item.currentStage)}>
              {item.currentStage.replaceAll("_", " ")}
            </span>
            <span className="rounded-full border border-[var(--as-accent-soft)] bg-[var(--as-accent-soft)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--as-accent)]">
              Template task
            </span>
          </div>

          <p className="mt-1 text-xs text-[var(--as-text-muted)]">
            {item.campaign
              ? `${item.campaign.wfNumber ? `${item.campaign.wfNumber} · ` : ""}${item.campaign.name}`
              : "No campaign linked"}
            {quantityLabel}
            {" · "}
            Updated {fmtRelative(item.updatedAt)}
          </p>

          {d.notes && (
            <p className="mt-1 text-[11px] text-[var(--as-text-subtle)]">{d.notes}</p>
          )}
        </div>

        <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
          {item.currentStage === "needs_template" && (
            <Button
              size="sm"
              variant="primary"
              loading={busyKey === `${item.workflowInstanceId}:start_drafting`}
              onClick={() => startTemplatingForDeliverable(item)}
            >
              <Wand2 className="h-3.5 w-3.5" />
              Start templating
            </Button>
          )}

          {item.currentStage === "drafting" && d.templateId && (
            <Link
              href={`/asset-studio/templates/${d.templateId}/edit`}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--as-border)] bg-[var(--as-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--as-text)] hover:border-[var(--as-accent)] hover:text-[var(--as-accent)]"
            >
              <PencilLine className="h-3.5 w-3.5" />
              Open template
            </Link>
          )}

          {item.availableTransitions
            .filter(
              (t) =>
                // start_drafting is handled by the bespoke button above so
                // the workflow advance happens alongside template creation.
                t.action !== "start_drafting"
            )
            .map((transition) => {
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
    );
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
        className="flex flex-col gap-4 border-[var(--as-border)] bg-[var(--as-surface)]"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-[var(--as-accent-soft)] p-2">
            <ListChecks className="h-5 w-5 text-[var(--as-accent)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--as-text)]">My Work</h2>
            <p className="text-sm text-[var(--as-text-muted)]">
              Deliverables to template and DAM handoffs scoped to {user.role}. Actions validated server-side.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          <StageStat
            label="Actionable"
            value={items.length}
            sub="In your queue"
            icon={ListChecks}
          />
          <StageStat
            label="Templates"
            value={summary?.publishedTemplateCount ?? 0}
            sub={`${summary?.templateCount ?? 0} total`}
            icon={FileImage}
          />
          <StageStat
            label="Active runs"
            value={summary?.activeRunCount ?? 0}
            sub="Queued or rendering"
            icon={PlayCircle}
          />
          <StageStat
            label="Mechanicals"
            value={summary?.variantsThisWeek ?? 0}
            sub="Last 7 days"
            icon={Images}
          />
          <StageStat
            label="Pending approval"
            value={summary?.pendingApprovalCount ?? 0}
            sub={`${summary?.approvedCount ?? 0} approved`}
            icon={CheckCircle2}
          />
        </div>
      </Card>

      {myCampaigns.length > 0 && (
        <Card padding="none" className="border-[var(--as-border)] bg-[var(--as-surface)]">
          <div className="flex items-center gap-2 border-b border-[var(--as-border)] px-4 py-3">
            <Palette className="h-4 w-4 text-[var(--as-accent)]" />
            <h3 className="text-sm font-semibold text-[var(--as-text)]">My campaigns</h3>
            <span className="ml-auto text-[11px] uppercase tracking-wider text-[var(--as-text-subtle)]">
              You own versioning
            </span>
          </div>
          <ul className="divide-y divide-[var(--as-border)]">
            {myCampaigns.map((row) => (
              <li key={row.campaign.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/campaigns/${row.campaign.id}/asset-studio`}
                      className="truncate text-sm font-semibold text-[var(--as-text)] hover:text-[var(--as-accent)]"
                    >
                      {row.campaign.wfNumber ? `${row.campaign.wfNumber} · ` : ""}
                      {row.campaign.name}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-[var(--as-text-subtle)]">
                      {row.roles
                        .map((r) =>
                          r === "primary_designer"
                            ? "Primary Designer"
                            : r === "primary_art_director"
                              ? "Primary Art Director"
                              : r
                        )
                        .join(" · ")}
                      {row.campaign.assetsDeliveryDate && (
                        <>
                          {" · "}
                          Assets due {row.campaign.assetsDeliveryDate}
                        </>
                      )}
                    </p>
                  </div>
                  <Link
                    href={`/campaigns/${row.campaign.id}/asset-studio`}
                    className="shrink-0 text-[11px] uppercase tracking-wider text-[var(--as-text-muted)] hover:text-[var(--as-text)]"
                  >
                    Open →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {items.length === 0 ? (
        <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
          <EmptyState
            title="No actionable items"
            description="Deliverables to template and DAM lifecycle handoffs will appear here when your role can move the current stage."
          />
        </Card>
      ) : (
        <Card padding="none" className="border-[var(--as-border)] bg-[var(--as-surface)]">
          <ul className="divide-y divide-[var(--as-border)]">
            {items.map((item) => (
              <li key={item.workflowInstanceId} className="px-4 py-3">
                {item.entityType === "deliverable" && item.deliverable
                  ? renderDeliverableRow(item)
                  : renderAssetRow(item)}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function StageStat({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: number;
  sub?: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="relative rounded-md border border-[var(--as-border)] bg-[var(--as-surface-2)] px-3 py-2">
      {Icon && (
        <div className="absolute right-2 top-2 rounded-md bg-[var(--as-surface)] p-1.5 text-[var(--as-text-muted)]">
          <Icon className="h-3.5 w-3.5" />
        </div>
      )}
      <p className="pr-8 text-[11px] uppercase text-[var(--as-text-muted)]">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-[var(--as-text)]">
        {value.toLocaleString()}
      </p>
      {sub && (
        <p className="mt-0.5 text-[10px] text-[var(--as-text-subtle)]">{sub}</p>
      )}
    </div>
  );
}
