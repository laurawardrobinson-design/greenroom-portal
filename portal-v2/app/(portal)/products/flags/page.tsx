"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Apple,
  ArrowLeft,
  Beef,
  Check,
  Cookie,
  Flag,
  Sandwich,
  ShoppingBasket,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ProductFlag,
  ProductFlagStatus,
} from "@/lib/services/product-flags.service";
import type { PRDepartment } from "@/types/domain";

const DEPT_ICONS: Record<PRDepartment, LucideIcon> = {
  Bakery: Cookie,
  Produce: Apple,
  Deli: Sandwich,
  "Meat-Seafood": Beef,
  Grocery: ShoppingBasket,
};

async function fetcher(url: string): Promise<ProductFlag[]> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

function formatRelative(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.max(1, Math.round((now - then) / 60000));
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function reasonLabel(reason: ProductFlag["reason"]) {
  return reason === "inaccurate" ? "Inaccurate" : "About to change";
}

export default function ProductFlagsPage() {
  const { user } = useCurrentUser();
  const [tab, setTab] = useState<ProductFlagStatus>("open");

  const { data, isLoading, mutate } = useSWR<ProductFlag[]>(
    `/api/product-flags?status=${tab}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const canResolve =
    user?.role === "Producer" ||
    user?.role === "Post Producer" ||
    user?.role === "Admin";

  const flags = useMemo(() => data ?? [], [data]);
  const openCount = useMemo(
    () => (tab === "open" ? flags.length : null),
    [flags, tab]
  );

  const resolve = useCallback(
    async (flagId: string, note: string) => {
      await fetch(`/api/product-flags/${flagId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      mutate();
    },
    [mutate]
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div>
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-[12px] text-text-tertiary hover:text-text-primary transition-colors mb-1"
        >
          <ArrowLeft className="h-3 w-3" />
          All products
        </Link>
        <div className="flex items-center justify-between gap-3">
          <PageHeader title="Product Flags" />
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-surface">
            {(["open", "resolved"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-3 py-1 rounded-md text-[12px] font-medium capitalize transition-colors ${
                  tab === k
                    ? "bg-surface-secondary text-text-primary"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {k}
                {k === "open" && openCount !== null && openCount > 0 && (
                  <span className="ml-1 tabular-nums">({openCount})</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[13px] text-text-tertiary mt-1">
          Flags raised by RBU departments on inventory items.{" "}
          {canResolve
            ? "You can clear flags once the underlying issue is addressed."
            : "Only producers can clear flags."}
        </p>
      </div>

      {isLoading ? (
        <div className="h-40 rounded-xl bg-surface-secondary animate-pulse" />
      ) : flags.length === 0 ? (
        <Card padding="none">
          <div className="px-6 py-10 text-center">
            <Flag className="h-6 w-6 text-text-tertiary mx-auto" />
            <p className="mt-2 text-[13px] text-text-tertiary">
              {tab === "open"
                ? "No open flags. All clear."
                : "No resolved flags yet."}
            </p>
          </div>
        </Card>
      ) : (
        <ul className="space-y-3">
          {flags.map((f) => (
            <FlagRow
              key={f.id}
              flag={f}
              canResolve={canResolve && f.status === "open"}
              onResolve={resolve}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FlagRow({
  flag,
  canResolve,
  onResolve,
}: {
  flag: ProductFlag;
  canResolve: boolean;
  onResolve: (flagId: string, note: string) => Promise<void>;
}) {
  const [showResolve, setShowResolve] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const DeptIcon = DEPT_ICONS[flag.flaggedByDept];

  const submit = async () => {
    setSubmitting(true);
    try {
      await onResolve(flag.id, note);
      setShowResolve(false);
      setNote("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <li>
      <Card padding="none">
        <CardHeader>
          <CardTitle>
            <Flag />
            <span className="truncate">{flag.product?.name ?? "Unknown"}</span>
            <span className="text-[10px] font-medium text-text-tertiary normal-case tracking-normal ml-0.5">
              · #{flag.product?.itemCode ?? "—"}
            </span>
          </CardTitle>
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
              flag.status === "open"
                ? "bg-amber-50 text-amber-800 border border-amber-200"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
            }`}
          >
            {flag.status}
          </span>
        </CardHeader>
        <div className="px-3.5 py-3 space-y-3">
          <div className="flex items-start gap-3">
            {flag.product?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={flag.product.imageUrl}
                alt={flag.product.name}
                className="h-14 w-14 rounded-lg object-cover shrink-0 bg-surface-tertiary"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface-tertiary shrink-0">
                <ShoppingBasket className="h-5 w-5 text-text-tertiary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-tertiary">
                <span className="inline-flex items-center gap-1">
                  <DeptIcon className="h-3 w-3" />
                  {flag.flaggedByDept} team
                </span>
                <span>·</span>
                <span
                  className={`font-medium ${
                    flag.reason === "about_to_change"
                      ? "text-sky-700"
                      : "text-rose-700"
                  }`}
                >
                  {reasonLabel(flag.reason)}
                </span>
                <span>·</span>
                <span>{formatRelative(flag.createdAt)}</span>
              </div>
              {flag.comment && (
                <p className="mt-1.5 text-[13px] text-text-primary whitespace-pre-wrap">
                  {flag.comment}
                </p>
              )}
            </div>
          </div>

          {flag.status === "resolved" && (
            <div className="text-[12px] text-text-tertiary border-t border-border/60 pt-2">
              Resolved by{" "}
              <span className="text-text-primary font-medium">
                {flag.resolvedByName ?? "—"}
              </span>
              {flag.resolvedAt && ` · ${formatRelative(flag.resolvedAt)}`}
              {flag.resolutionNote && (
                <p className="mt-1 italic text-text-secondary">
                  “{flag.resolutionNote}”
                </p>
              )}
            </div>
          )}

          {canResolve &&
            (showResolve ? (
              <div className="border-t border-border/60 pt-3 space-y-2">
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Resolution note (optional)"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none resize-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowResolve(false);
                      setNote("");
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[12px] text-text-secondary hover:bg-surface-secondary"
                  >
                    <X className="h-3 w-3" />
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={submitting}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" />
                    {submitting ? "Clearing…" : "Clear flag"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-border/60 pt-2 flex justify-end">
                <button
                  onClick={() => setShowResolve(true)}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-[12px] font-medium text-white hover:bg-primary/90 transition-colors"
                >
                  <Check className="h-3 w-3" />
                  Clear flag
                </button>
              </div>
            ))}
        </div>
      </Card>
    </li>
  );
}
