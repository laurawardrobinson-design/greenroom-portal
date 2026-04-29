"use client";

import { useState } from "react";
import useSWR from "swr";
import { CheckCircle2, Flag, ShoppingBasket, Undo2 } from "lucide-react";
import type { ProductReviewRow } from "@/lib/services/products.service";
import type { Product } from "@/types/domain";
import { ProductImage } from "@/components/products/product-image";
import { ProductDrawer, DEPT_COLORS } from "@/components/products/product-drawer";
import { RaiseFlagDialog } from "@/components/products/raise-flag-dialog";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function daysUntil(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, (m || 1) - 1, d || 1);
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - todayMid.getTime()) / 86400000);
}

type Sub = "pending" | "approved";

export function ReviewTab({
  canEdit,
  hideTeamNotes = false,
  rbuToken = null,
}: {
  canEdit: boolean;
  hideTeamNotes?: boolean;
  // When set, the RBU token route is used (no auth session). The endpoint
  // returns `{ department, rows }` instead of `rows[]` directly, so we
  // unwrap accordingly.
  rbuToken?: string | null;
}) {
  // RBU users have no auth session, but they're the primary reviewers —
  // approve + flag are their core actions, so they get the same buttons
  // BMM/Producers see, just routed through token-gated endpoints.
  const canReview = canEdit || !!rbuToken;
  const reviewUrl = rbuToken
    ? `/api/rbu/${rbuToken}/products/review`
    : "/api/products/review";
  const { data: rawReview, isLoading, mutate } = useSWR<
    ProductReviewRow[] | { rows: ProductReviewRow[] }
  >(reviewUrl, fetcher);
  const data: ProductReviewRow[] | undefined = Array.isArray(rawReview)
    ? rawReview
    : rawReview && Array.isArray(rawReview.rows)
      ? rawReview.rows
      : undefined;
  const { data: flagCounts } = useSWR<Record<string, number>>(
    rbuToken ? null : "/api/product-flags/counts",
    fetcher,
    { refreshInterval: 30000 }
  );
  const [drawer, setDrawer] = useState<{ row: ProductReviewRow; product: Product } | null>(null);
  const [flagFor, setFlagFor] = useState<ProductReviewRow | null>(null);
  const [sub, setSub] = useState<Sub>("pending");
  const { toast } = useToast();

  const rows = Array.isArray(data) ? data : [];

  async function openDrawer(row: ProductReviewRow) {
    try {
      const url = rbuToken
        ? `/api/rbu/${rbuToken}/products/${row.product.id}`
        : `/api/products/${row.product.id}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const full = (await res.json()) as Product;
      setDrawer({ row, product: full });
    } catch {
      toast("error", "Couldn't open product");
    }
  }

  // The SWR cache holds either a flat row array (BMM endpoint) or a wrapped
  // `{ rows }` (RBU endpoint). The optimistic helpers preserve the original
  // shape so subsequent reads via `data` remain consistent.
  function patchRows(
    curr: ProductReviewRow[] | { rows: ProductReviewRow[] } | undefined,
    fn: (r: ProductReviewRow) => ProductReviewRow
  ): ProductReviewRow[] | { rows: ProductReviewRow[] } {
    if (!curr) return [];
    if (Array.isArray(curr)) return curr.map(fn);
    return { ...curr, rows: curr.rows.map(fn) };
  }

  async function approve(row: ProductReviewRow) {
    // Optimistic — flip the row's approved state in cached data.
    mutate(
      (curr) =>
        patchRows(curr, (r) =>
          r.campaignProductId === row.campaignProductId
            ? { ...r, rbuApprovedAt: new Date().toISOString() }
            : r
        ),
      { revalidate: false }
    );
    try {
      const url = rbuToken
        ? `/api/rbu/${rbuToken}/products/review/${row.campaignProductId}/approve`
        : `/api/products/review/${row.campaignProductId}/approve`;
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) throw new Error();
      toast("success", "Approved as accurate");
      mutate();
    } catch {
      toast("error", "Couldn't approve");
      mutate();
    }
  }

  async function unapprove(row: ProductReviewRow) {
    mutate(
      (curr) =>
        patchRows(curr, (r) =>
          r.campaignProductId === row.campaignProductId
            ? { ...r, rbuApprovedAt: null }
            : r
        ),
      { revalidate: false }
    );
    try {
      const url = rbuToken
        ? `/api/rbu/${rbuToken}/products/review/${row.campaignProductId}/approve`
        : `/api/products/review/${row.campaignProductId}/approve`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("success", "Moved back to pending");
      mutate();
    } catch {
      toast("error", "Couldn't update");
      mutate();
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBasket className="h-5 w-5" />}
        title="No upcoming product use"
        description="Once products are linked to scheduled or planning campaigns, they show up here."
      />
    );
  }

  const pending = rows.filter((r) => !r.rbuApprovedAt);
  const approved = rows.filter((r) => r.rbuApprovedAt);
  const soon = pending.filter((r) => r.date && daysUntil(r.date) <= 14);
  const later = pending.filter((r) => !soon.includes(r));

  return (
    <>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1 w-fit">
        <SubButton active={sub === "pending"} onClick={() => setSub("pending")}>
          Pending
          {pending.length > 0 && (
            <span className="ml-1.5 rounded-full bg-warning/15 text-warning px-1.5 py-px text-[10px] font-semibold">
              {pending.length}
            </span>
          )}
        </SubButton>
        <SubButton active={sub === "approved"} onClick={() => setSub("approved")}>
          Approved
          {approved.length > 0 && (
            <span className="ml-1.5 rounded-full bg-success/15 text-success px-1.5 py-px text-[10px] font-semibold">
              {approved.length}
            </span>
          )}
        </SubButton>
      </div>

      {sub === "pending" ? (
        <div className="space-y-6">
          <Section
            title="Shooting in the next 14 days"
            empty="Nothing scheduled in the next 14 days."
            rows={soon}
          >
            {soon.map((r, i) => (
              <ReviewTile
                key={`${r.campaignProductId}-${i}`}
                row={r}
                flagCount={flagCounts?.[r.product.id] ?? 0}
                onOpen={() => openDrawer(r)}
                onApprove={canReview ? () => approve(r) : null}
                onFlag={canReview ? () => setFlagFor(r) : null}
              />
            ))}
          </Section>
          <Section
            title="Later & planning"
            empty="No further upcoming use."
            rows={later}
          >
            {later.map((r, i) => (
              <ReviewTile
                key={`${r.campaignProductId}-${i}`}
                row={r}
                flagCount={flagCounts?.[r.product.id] ?? 0}
                onOpen={() => openDrawer(r)}
                onApprove={canReview ? () => approve(r) : null}
                onFlag={canReview ? () => setFlagFor(r) : null}
              />
            ))}
          </Section>
        </div>
      ) : approved.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="No approved items yet"
          description="Items approved by the RBU as accurate move here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {approved.map((r, i) => (
            <ReviewTile
              key={`${r.campaignProductId}-${i}`}
              row={r}
              flagCount={flagCounts?.[r.product.id] ?? 0}
              onOpen={() => openDrawer(r)}
              onUndo={canReview ? () => unapprove(r) : null}
            />
          ))}
        </div>
      )}

      {flagFor && (
        <RaiseFlagDialog
          productId={flagFor.product.id}
          productName={flagFor.product.name}
          productDept={flagFor.product.department}
          rbuToken={rbuToken}
          onClose={() => setFlagFor(null)}
          onCreated={() => {
            setFlagFor(null);
            mutate();
          }}
        />
      )}

      {drawer && (
        <ProductDrawer
          product={drawer.product}
          onClose={() => setDrawer(null)}
          onSaved={() => mutate()}
          onDeleted={() => {
            setDrawer(null);
            mutate();
          }}
          canEdit={canEdit}
          hideTeamNotes={hideTeamNotes}
          reviewMode={!drawer.row.rbuApprovedAt}
          rbuToken={rbuToken}
        />
      )}
    </>
  );
}

function Section({
  title,
  empty,
  rows,
  children,
}: {
  title: string;
  empty: string;
  rows: ProductReviewRow[];
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
          {title}
        </h2>
        <span className="text-[11px] text-text-tertiary">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-text-tertiary">{empty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {children}
        </div>
      )}
    </section>
  );
}

function SubButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors inline-flex items-center ${
        active
          ? "bg-surface-secondary text-text-primary"
          : "text-text-secondary hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function ReviewTile({
  row: r,
  flagCount,
  onOpen,
  onApprove,
  onFlag,
  onUndo,
}: {
  row: ProductReviewRow;
  flagCount: number;
  onOpen: () => void;
  onApprove?: (() => void) | null;
  onFlag?: (() => void) | null;
  onUndo?: (() => void) | null;
}) {
  const campaignLine = [r.wfNumber, r.campaignName].filter(Boolean).join(" ");
  const days = r.date ? daysUntil(r.date) : null;
  return (
    <div
      onClick={onOpen}
      className={`relative flex h-full cursor-pointer flex-col rounded-xl border bg-surface p-4 text-left transition-colors ${
        flagCount > 0
          ? "border-amber-300 hover:bg-amber-50/40"
          : "border-border hover:bg-surface-secondary"
      }`}
    >
      {flagCount > 0 && (
        <span
          className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-amber-50 text-warning border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium"
          title={`${flagCount} open flag${flagCount === 1 ? "" : "s"}`}
        >
          <Flag className="h-2.5 w-2.5" />
          {flagCount}
        </span>
      )}
      <div className="flex items-start gap-3">
        <ProductImage
          src={r.product.imageUrl}
          alt={r.product.name}
          className="h-14 w-14 rounded-lg object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">
            {r.product.name}
          </p>
          {r.product.itemCode && (
            <p className="text-[10px] text-text-tertiary leading-tight">
              {r.product.itemCode}
            </p>
          )}
          <Badge
            variant="custom"
            className={`mt-1 ${DEPT_COLORS[r.product.department] || DEPT_COLORS.Other}`}
          >
            {r.product.department}
          </Badge>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-border-light space-y-0.5">
        <p className="text-xs text-text-secondary truncate">
          {campaignLine || "—"}
        </p>
        <p className="text-[10px] text-text-tertiary">
          {r.date
            ? `Shooting ${formatDate(r.date)}${
                days !== null && days >= 0 && days <= 14
                  ? ` · ${days === 0 ? "today" : `in ${days}d`}`
                  : ""
              }`
            : "Planning"}
          {r.role ? ` · ${r.role}` : ""}
        </p>
      </div>
      <div
        className="mt-3 flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {onApprove && (
          <>
            <button
              type="button"
              onClick={onApprove}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-primary text-white px-2 py-1.5 text-[11px] font-medium hover:bg-primary/90 transition-colors"
            >
              <CheckCircle2 className="h-3 w-3" />
              Approve
            </button>
            <button
              type="button"
              onClick={onFlag ?? onOpen}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-border bg-surface px-2 py-1.5 text-[11px] font-medium text-text-secondary hover:border-amber-400 hover:text-warning hover:bg-amber-50 transition-colors"
            >
              <Flag className="h-3 w-3" />
              Flag
            </button>
          </>
        )}
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="ml-auto inline-flex items-center justify-center gap-1 rounded-md border border-border bg-surface px-2 py-1.5 text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <Undo2 className="h-3 w-3" />
            Undo
          </button>
        )}
        {!onApprove && !onUndo && r.rbuApprovedAt && (
          <span className="inline-flex items-center gap-1 text-[11px] text-success">
            <CheckCircle2 className="h-3 w-3" />
            Approved
          </span>
        )}
      </div>
    </div>
  );
}
