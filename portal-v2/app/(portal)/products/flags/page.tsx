"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Apple,
  ArrowLeft,
  Beef,
  Cookie,
  Flag,
  Sandwich,
  ShoppingBasket,
  type LucideIcon,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import type {
  ProductFlag,
  ProductFlagStatus,
} from "@/lib/services/product-flags.service";
import type { PRDepartment } from "@/types/domain";
import { FlagReviewModal } from "@/components/products/flag-review-modal";

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
  const [activeFlagId, setActiveFlagId] = useState<string | null>(null);

  const { data, isLoading, mutate } = useSWR<ProductFlag[]>(
    `/api/product-flags?status=${tab}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const canResolve =
    user?.role === "Producer" ||
    user?.role === "Post Producer" ||
    user?.role === "Admin";
  const canEdit = canResolve || user?.role === "Art Director" || user?.role === "Studio";

  const flags = useMemo(() => data ?? [], [data]);
  const openCount = useMemo(
    () => (tab === "open" ? flags.length : null),
    [flags, tab]
  );
  const activeFlag = useMemo(
    () => flags.find((f) => f.id === activeFlagId) ?? null,
    [flags, activeFlagId]
  );

  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-[12px] text-text-tertiary hover:text-text-primary transition-colors mb-1"
        >
          <ArrowLeft className="h-3 w-3" />
          All products
        </Link>
        <PageHeader
          title="Product Flags"
          actions={(
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
          )}
        />
        <p className="text-[13px] text-text-tertiary mt-1">
          Click any flag to review the product and clear or reopen it.
        </p>
      </div>

      <div className="max-w-xl">
        {isLoading ? (
          <div className="h-20 rounded-xl bg-surface-secondary animate-pulse" />
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
          <ul className="space-y-2">
            {flags.map((f) => (
              <FlagRow
                key={f.id}
                flag={f}
                onClick={() => setActiveFlagId(f.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {activeFlag && (
        <FlagReviewModal
          flag={activeFlag}
          canResolve={canResolve && activeFlag.status === "open"}
          canReopen={canResolve && activeFlag.status === "resolved"}
          canEdit={canEdit}
          onClose={() => setActiveFlagId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function FlagRow({
  flag,
  onClick,
}: {
  flag: ProductFlag;
  onClick: () => void;
}) {
  const DeptIcon = DEPT_ICONS[flag.flaggedByDept];

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-left hover:bg-surface-secondary transition-colors"
      >
        <div className="flex items-start gap-2.5">
          {flag.product?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={flag.product.imageUrl}
              alt={flag.product.name}
              className="h-11 w-11 rounded-md object-cover shrink-0 bg-surface-tertiary"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-surface-tertiary shrink-0">
              <ShoppingBasket className="h-4 w-4 text-text-tertiary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Flag
                className={`h-3 w-3 shrink-0 ${
                  flag.status === "open" ? "text-warning" : "text-success"
                }`}
              />
              <span className="text-[13px] font-semibold text-text-primary truncate">
                {flag.product?.name ?? "Unknown"}
              </span>
              {flag.product?.itemCode && (
                <span className="text-[10px] text-text-tertiary shrink-0">
                  #{flag.product.itemCode}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-tertiary">
              <span className="inline-flex items-center gap-1">
                <DeptIcon className="h-3 w-3" />
                {flag.flaggedByDept}
              </span>
              <span>·</span>
              <span
                className={`font-medium ${
                  flag.reason === "about_to_change"
                    ? "text-sky-700"
                    : "text-error"
                }`}
              >
                {reasonLabel(flag.reason)}
              </span>
              <span>·</span>
              <span>{formatRelative(flag.createdAt)}</span>
            </div>
            {flag.comment && (
              <p className="mt-1 text-[12px] text-text-secondary line-clamp-2">
                {flag.comment}
              </p>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}
