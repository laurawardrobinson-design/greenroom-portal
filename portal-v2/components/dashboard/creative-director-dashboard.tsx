"use client";

import useSWR, { mutate } from "swr";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  Inbox,
  Check,
  ArrowUpRight,
  ImageOff,
  Sparkles,
  Clock,
} from "lucide-react";
import type { AppUser } from "@/types/domain";
import type { PendingBatch } from "@/lib/services/pending-batches.service";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { useToast } from "@/components/ui/toast";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const PENDING_URL = "/api/asset-studio/pending-batches";

function TileHeader({
  icon: Icon,
  title,
  trailing,
}: {
  icon: React.ElementType;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
        {title}
      </span>
      {trailing && <div className="ml-auto">{trailing}</div>}
    </div>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.round(days / 7);
  return `${weeks} wk${weeks === 1 ? "" : "s"} ago`;
}

export function CreativeDirectorDashboard({ user }: { user: AppUser }) {
  const { data: batches, isLoading } = useSWR<PendingBatch[]>(PENDING_URL, fetcher);
  const { toast } = useToast();
  const [approving, setApproving] = useState<string | null>(null);

  const batchCount = batches?.length ?? 0;
  const totalPending = (batches ?? []).reduce((n, b) => n + b.pendingCount, 0);
  const campaignCount = new Set(
    (batches ?? [])
      .map((b) => b.campaign?.id)
      .filter((id): id is string => Boolean(id))
  ).size;

  async function approveBatch(batch: PendingBatch) {
    if (batch.pendingVariantIds.length === 0) return;
    setApproving(batch.runId);
    try {
      const res = await fetch("/api/asset-studio/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: batch.pendingVariantIds, action: "approve" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't approve batch");
      }
      const { updated, skipped = 0 } = (await res.json()) as {
        updated: number;
        skipped?: number;
      };
      toast(
        "success",
        `${updated} mechanical${updated === 1 ? "" : "s"} approved${
          skipped > 0 ? ` · ${skipped} skipped` : ""
        }`
      );
      mutate(PENDING_URL);
    } catch (err) {
      toast("error", (err as Error).message ?? "Couldn't approve batch");
    } finally {
      setApproving(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">
        Welcome back, {user.name?.split(" ")[0] || "there"}
      </h1>

      <Card padding="none" className="overflow-hidden">
        <TileHeader
          icon={Inbox}
          title="Mechanical Batches"
          trailing={
            <Link
              href="/asset-studio?tab=variants"
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-tertiary hover:text-text-secondary"
            >
              <Sparkles className="h-3 w-3" />
              Review in Asset Studio
            </Link>
          }
        />
        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="space-y-3 px-3.5 py-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : batchCount === 0 ? (
            <EmptyState
              icon={<Check className="h-5 w-5" />}
              title="All caught up"
              description="No mechanical batches waiting for review. New work will appear here the moment a designer submits it."
            />
          ) : (
            batches!.map((batch) => (
              <BatchRow
                key={batch.runId}
                batch={batch}
                isApproving={approving === batch.runId}
                onApprove={() => approveBatch(batch)}
              />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function BatchRow({
  batch,
  isApproving,
  onApprove,
}: {
  batch: PendingBatch;
  isApproving: boolean;
  onApprove: () => void;
}) {
  const wf = batch.campaign?.wfNumber ? `${batch.campaign.wfNumber} ` : "";
  const campaignLabel = batch.campaign
    ? `${wf}${batch.campaign.name}`
    : "Unassigned campaign";
  const templateLabel = batch.template?.name ?? "Untitled template";

  return (
    <div className="px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">
            {campaignLabel}
          </p>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            {templateLabel} · {batch.runName}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-text-tertiary">
            <Clock className="h-3 w-3" />
            {batch.pendingCount} mechanical{batch.pendingCount === 1 ? "" : "s"}
            {" · "}
            submitted {relativeTime(batch.oldestPendingAt)}
            {batch.pendingCount < batch.totalCount && (
              <> · {batch.totalCount - batch.pendingCount} already reviewed</>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/asset-studio/runs/${batch.runId}`}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-secondary"
          >
            Open run
            <ArrowUpRight className="h-3 w-3" />
          </Link>
          <Button
            size="sm"
            onClick={onApprove}
            disabled={isApproving}
          >
            <Check className="h-3.5 w-3.5" />
            {isApproving ? "Approving…" : `Approve all ${batch.pendingCount}`}
          </Button>
        </div>
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto">
        {batch.thumbnails.map((t) => (
          <div
            key={t.id}
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-white"
            title={[t.productName, t.specLabel].filter(Boolean).join(" · ")}
          >
            {t.thumbnailUrl || t.assetUrl ? (
              <Image
                src={`${t.thumbnailUrl ?? t.assetUrl}?v=${encodeURIComponent(t.updatedAt)}`}
                alt={t.productName ?? "mechanical"}
                fill
                sizes="64px"
                className="object-contain"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-text-tertiary">
                <ImageOff className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}
        {batch.pendingCount > batch.thumbnails.length && (
          <div className="flex h-16 min-w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-border px-2 text-[11px] text-text-tertiary">
            +{batch.pendingCount - batch.thumbnails.length} more
          </div>
        )}
      </div>
    </div>
  );
}
