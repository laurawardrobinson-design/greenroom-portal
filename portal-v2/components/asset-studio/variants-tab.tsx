"use client";

import { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import type { AppUser, Variant, VariantStatus } from "@/types/domain";
import { fetcher, statusPillClass } from "./lib";
import { Check, X, ImageOff } from "lucide-react";

interface Props {
  user: AppUser;
  campaignId?: string;
}

const STATUS_OPTIONS: Array<{ value: "" | VariantStatus; label: string }> = [
  { value: "", label: "All" },
  { value: "rendered", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "failed", label: "Failed" },
];

export function VariantsTab({ user, campaignId }: Props) {
  const [status, setStatus] = useState<"" | VariantStatus>("rendered");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const canApprove = ["Admin", "Creative Director"].includes(user.role);

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (campaignId) params.set("campaignId", campaignId);
  params.set("limit", "200");
  const url = `/api/asset-studio/variants?${params.toString()}`;
  const { data, isLoading } = useSWR<Variant[]>(url, fetcher);
  const { toast } = useToast();

  const allSelected = useMemo(
    () => Boolean(data?.length && selected.size === data.length),
    [data, selected]
  );

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }
  function toggleAll() {
    if (!data) return;
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(data.map((v) => v.id)));
  }

  async function bulk(action: "approve" | "reject") {
    if (selected.size === 0) return;
    const reason =
      action === "reject" ? window.prompt("Reason (optional)") ?? "" : "";
    try {
      const res = await fetch("/api/asset-studio/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), action, reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Bulk action failed");
      }
      const { updated, skipped = 0 } = (await res.json()) as {
        updated: number;
        skipped?: number;
      };
      toast(
        action === "approve" ? "success" : "info",
        `${updated} variant${updated === 1 ? "" : "s"} ${action}d${
          skipped > 0 ? ` · ${skipped} skipped` : ""
        }`
      );
      setSelected(new Set());
      mutate(url);
    } catch (err) {
      console.error(err);
      toast("error", (err as Error).message ?? "Bulk action failed");
    }
  }

  async function singleAction(variantId: string, action: "approve" | "reject") {
    const reason = action === "reject" ? window.prompt("Reason (optional)") ?? "" : "";
    try {
      const res =
        action === "approve"
          ? await fetch(`/api/asset-studio/variants/${variantId}/approve`, {
              method: "POST",
            })
          : await fetch(`/api/asset-studio/variants/${variantId}/reject`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason }),
            });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Couldn't ${action} variant`);
      }
      toast(action === "approve" ? "success" : "info", `Variant ${action}d`);
      mutate(url);
    } catch (err) {
      console.error(err);
      toast("error", (err as Error).message ?? "Action failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value || "all"}
              onClick={() => {
                setStatus(opt.value);
                setSelected(new Set());
              }}
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
        {canApprove && data && data.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-medium text-[var(--as-text-muted)] hover:text-[var(--as-text)]"
            >
              {allSelected ? "Clear selection" : "Select all"}
            </button>
            <Button
              size="sm"
              variant="outline"
              disabled={selected.size === 0}
              onClick={() => bulk("reject")}
            >
              <X className="h-3.5 w-3.5" />
              Reject ({selected.size})
            </Button>
            <Button
              size="sm"
              disabled={selected.size === 0}
              onClick={() => bulk("approve")}
            >
              <Check className="h-3.5 w-3.5" />
              Approve ({selected.size})
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-lg border border-[var(--as-border)] bg-[var(--as-surface)] animate-pulse"
            />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
          <EmptyState
            title="No mechanicals"
            description={
              status === "rendered"
                ? "Nothing waiting for approval. Kick off a run to generate more."
                : "No mechanicals match this filter."
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {data.map((v) => (
            <VariantCard
              key={v.id}
              variant={v}
              selected={selected.has(v.id)}
              onToggle={canApprove ? () => toggle(v.id) : undefined}
              onApprove={
                canApprove
                  ? async () => singleAction(v.id, "approve")
                  : undefined
              }
              onReject={
                canApprove
                  ? async () => singleAction(v.id, "reject")
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VariantCard({
  variant,
  selected,
  onToggle,
  onApprove,
  onReject,
}: {
  variant: Variant;
  selected: boolean;
  onToggle?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-lg border bg-[var(--as-surface)] transition-all ${
        selected
          ? "border-[var(--as-accent)] ring-2 ring-[var(--as-accent-ring)]"
          : "border-[var(--as-border)] hover:shadow-md"
      }`}
    >
      <div className="relative aspect-square bg-white">
        {variant.assetUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${variant.thumbnailUrl ?? variant.assetUrl}?v=${encodeURIComponent(variant.updatedAt)}`}
            alt={variant.product?.name ?? "Variant"}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--as-text-subtle)]">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={selected ? "Deselect" : "Select"}
            className={`absolute left-2 top-2 grid h-5 w-5 place-items-center rounded border ${
              selected
                ? "border-[var(--as-accent)] bg-[var(--as-accent)] text-white"
                : "border-white/50 bg-black/20 text-transparent hover:bg-black/30"
            }`}
          >
            <Check className="h-3 w-3" />
          </button>
        )}
        <span
          className={`absolute right-2 top-2 ${statusPillClass(variant.status)}`}
        >
          {variant.status}
        </span>
      </div>

      <div className="p-2.5">
        <p className="truncate text-xs font-medium text-[var(--as-text)]">
          {variant.product?.name || "Variant"}
        </p>
        <p className="text-[11px] text-[var(--as-text-subtle)]">
          {variant.outputSpec?.label ?? `${variant.width}×${variant.height}`}
        </p>

        {(onApprove || onReject) && variant.status === "rendered" && (
          <div className="mt-2 flex gap-1">
            {onReject && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={onReject}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            {onApprove && (
              <Button size="sm" className="flex-1" onClick={onApprove}>
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
