"use client";

import { use, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Apple,
  Beef,
  Cookie,
  Flag,
  Sandwich,
  ShoppingBasket,
  Sparkles,
  Clock,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import type { ProductFlag } from "@/lib/services/product-flags.service";
import type { PRDepartment, Product } from "@/types/domain";
import { PR_DEPARTMENTS } from "@/types/domain";
import { FlagReviewModal } from "@/components/products/flag-review-modal";
import { ProductDrawer, PHASE_COLORS, PHASE_LABELS } from "@/components/products/product-drawer";
import { RaiseFlagDialog } from "@/components/products/raise-flag-dialog";

const ALLOWED_ROLES = [
  "Admin",
  "Brand Marketing Manager",
  "Producer",
  "Post Producer",
] as const;

const DEPT_ICONS: Record<PRDepartment, LucideIcon> = {
  Bakery: Cookie,
  Produce: Apple,
  Deli: Sandwich,
  "Meat-Seafood": Beef,
  Grocery: ShoppingBasket,
};

type Tab = "flags" | "coming_soon" | "planning";

async function fetcher<T>(url: string): Promise<T> {
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

function parseDept(raw: string): PRDepartment | null {
  const decoded = decodeURIComponent(raw);
  return (PR_DEPARTMENTS as string[]).includes(decoded)
    ? (decoded as PRDepartment)
    : null;
}

export default function BrandMarketingReviewPage({
  params,
}: {
  params: Promise<{ dept: string }>;
}) {
  const { dept: rawDept } = use(params);
  const router = useRouter();
  const { user, isLoading: userLoading } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("flags");
  const [activeFlagId, setActiveFlagId] = useState<string | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [raiseFlagFor, setRaiseFlagFor] = useState<Product | null>(null);

  const dept = useMemo(() => parseDept(rawDept), [rawDept]);

  const canEdit =
    user?.role === "Admin" ||
    user?.role === "Producer" ||
    user?.role === "Post Producer";
  const canResolve = canEdit;

  const { data: flagsData, isLoading: flagsLoading, mutate: mutateFlags } =
    useSWR<ProductFlag[]>(
      dept ? `/api/product-flags?status=open&dept=${encodeURIComponent(dept)}` : null,
      fetcher,
      { refreshInterval: 30000 }
    );

  const { data: comingSoonData, isLoading: comingLoading, mutate: mutateComing } =
    useSWR<Product[]>(
      dept
        ? `/api/products?lifecycle_phase=coming_soon&department=${encodeURIComponent(dept)}`
        : null,
      fetcher
    );

  const { data: planningData, isLoading: planningLoading, mutate: mutatePlanning } =
    useSWR<Product[]>(
      dept
        ? `/api/products?lifecycle_phase=planning&department=${encodeURIComponent(dept)}`
        : null,
      fetcher
    );

  const flags = flagsData ?? [];
  const comingSoon = comingSoonData ?? [];
  const planning = planningData ?? [];
  const activeFlag = useMemo(
    () => flags.find((f) => f.id === activeFlagId) ?? null,
    [flags, activeFlagId]
  );

  const refreshAll = useCallback(() => {
    mutateFlags();
    mutateComing();
    mutatePlanning();
  }, [mutateFlags, mutateComing, mutatePlanning]);

  if (userLoading || !user) return <DashboardSkeleton />;
  if (!ALLOWED_ROLES.includes(user.role as any)) {
    router.replace("/dashboard");
    return null;
  }

  if (!dept) {
    return (
      <div className="space-y-5">
        <PageHeader title="Review" />
        <p className="text-[13px] text-text-tertiary">
          Pick a department to start.
        </p>
        <DeptPills active={null} onChange={(d) => router.push(`/brand-marketing/review/${d}`)} />
      </div>
    );
  }

  const DeptIcon = DEPT_ICONS[dept];

  return (
    <div className="space-y-5">
      <div>
        <div className="inline-flex items-center gap-1 text-[12px] text-text-tertiary mb-1">
          <Sparkles className="h-3 w-3" />
          Brand Marketing
        </div>
        <PageHeader
          title={
            <span className="inline-flex items-center gap-2">
              <DeptIcon className="h-5 w-5 text-primary" />
              {dept} review
            </span>
          }
        />
        <p className="text-[13px] text-text-tertiary mt-1">
          Everything flagged, pending, or in planning for {dept} — sync point
          before the next shoot.
        </p>
      </div>

      <DeptPills
        active={dept}
        onChange={(d) => router.push(`/brand-marketing/review/${d}`)}
      />

      <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-surface w-fit">
        <TabButton
          icon={Flag}
          label="Flags"
          count={flags.length}
          active={tab === "flags"}
          onClick={() => setTab("flags")}
        />
        <TabButton
          icon={CalendarClock}
          label="Coming Soon"
          count={comingSoon.length}
          active={tab === "coming_soon"}
          onClick={() => setTab("coming_soon")}
        />
        <TabButton
          icon={Clock}
          label="Planning"
          count={planning.length}
          active={tab === "planning"}
          onClick={() => setTab("planning")}
        />
      </div>

      <div className="max-w-2xl">
        {tab === "flags" && (
          <FlagsList
            loading={flagsLoading}
            flags={flags}
            onOpen={(id) => setActiveFlagId(id)}
          />
        )}
        {tab === "coming_soon" && (
          <ProductList
            loading={comingLoading}
            products={comingSoon}
            emptyText={`No Coming Soon items for ${dept}.`}
            onOpen={setActiveProduct}
            onRaiseFlag={setRaiseFlagFor}
          />
        )}
        {tab === "planning" && (
          <ProductList
            loading={planningLoading}
            products={planning}
            emptyText={`No Planning items for ${dept}.`}
            onOpen={setActiveProduct}
            onRaiseFlag={setRaiseFlagFor}
          />
        )}
      </div>

      {activeFlag && (
        <FlagReviewModal
          flag={activeFlag}
          canResolve={canResolve && activeFlag.status === "open"}
          canReopen={canResolve && activeFlag.status === "resolved"}
          canEdit={canEdit}
          onClose={() => setActiveFlagId(null)}
          onChanged={refreshAll}
        />
      )}

      {activeProduct && (
        <ProductDrawer
          product={activeProduct}
          canEdit={canEdit}
          onClose={() => setActiveProduct(null)}
          onSaved={() => refreshAll()}
          onDeleted={() => {
            setActiveProduct(null);
            refreshAll();
          }}
        />
      )}

      {raiseFlagFor && (
        <RaiseFlagDialog
          productId={raiseFlagFor.id}
          productName={raiseFlagFor.name}
          productDept={raiseFlagFor.department}
          onClose={() => setRaiseFlagFor(null)}
          onCreated={() => {
            setRaiseFlagFor(null);
            refreshAll();
          }}
        />
      )}
    </div>
  );
}

function DeptPills({
  active,
  onChange,
}: {
  active: PRDepartment | null;
  onChange: (dept: PRDepartment) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PR_DEPARTMENTS.map((d) => {
        const Icon = DEPT_ICONS[d];
        const isActive = active === d;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              isActive
                ? "bg-primary text-white"
                : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
            }`}
          >
            <Icon className="h-3 w-3" />
            {d}
          </button>
        );
      })}
    </div>
  );
}

function TabButton({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
        active
          ? "bg-surface-secondary text-text-primary"
          : "text-text-tertiary hover:text-text-secondary"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
      {count > 0 && (
        <span className="tabular-nums text-text-tertiary">({count})</span>
      )}
    </button>
  );
}

function FlagsList({
  loading,
  flags,
  onOpen,
}: {
  loading: boolean;
  flags: ProductFlag[];
  onOpen: (flagId: string) => void;
}) {
  if (loading) {
    return <div className="h-20 rounded-xl bg-surface-secondary animate-pulse" />;
  }
  if (flags.length === 0) {
    return (
      <Card padding="none">
        <div className="px-6 py-10 text-center">
          <Flag className="h-6 w-6 text-text-tertiary mx-auto" />
          <p className="mt-2 text-[13px] text-text-tertiary">
            No open flags. All clear.
          </p>
        </div>
      </Card>
    );
  }
  return (
    <ul className="space-y-2">
      {flags.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            onClick={() => onOpen(f.id)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-left hover:bg-surface-secondary transition-colors"
          >
            <div className="flex items-start gap-2.5">
              {f.product?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.product.imageUrl}
                  alt={f.product.name}
                  className="h-11 w-11 rounded-md object-cover shrink-0 bg-surface-tertiary"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-surface-tertiary shrink-0">
                  <ShoppingBasket className="h-4 w-4 text-text-tertiary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Flag className="h-3 w-3 shrink-0 text-warning" />
                  <span className="text-[13px] font-semibold text-text-primary truncate">
                    {f.product?.name ?? "Unknown"}
                  </span>
                  {f.product?.itemCode && (
                    <span className="text-[10px] text-text-tertiary shrink-0">
                      #{f.product.itemCode}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-tertiary">
                  <span
                    className={`font-medium ${
                      f.reason === "about_to_change"
                        ? "text-sky-700"
                        : "text-error"
                    }`}
                  >
                    {f.reason === "about_to_change" ? "About to change" : "Inaccurate"}
                  </span>
                  <span>·</span>
                  <span>{f.source === "producer" ? "Producer" : f.flaggedByDept}</span>
                  <span>·</span>
                  <span>{formatRelative(f.createdAt)}</span>
                </div>
                {f.comment && (
                  <p className="mt-1 text-[12px] text-text-secondary line-clamp-2">
                    {f.comment}
                  </p>
                )}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ProductList({
  loading,
  products,
  emptyText,
  onOpen,
  onRaiseFlag,
}: {
  loading: boolean;
  products: Product[];
  emptyText: string;
  onOpen: (p: Product) => void;
  onRaiseFlag: (p: Product) => void;
}) {
  if (loading) {
    return <div className="h-20 rounded-xl bg-surface-secondary animate-pulse" />;
  }
  if (products.length === 0) {
    return (
      <Card padding="none">
        <div className="px-6 py-10 text-center">
          <ShoppingBasket className="h-6 w-6 text-text-tertiary mx-auto" />
          <p className="mt-2 text-[13px] text-text-tertiary">{emptyText}</p>
        </div>
      </Card>
    );
  }
  return (
    <ul className="space-y-2">
      {products.map((p) => (
        <li key={p.id}>
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => onOpen(p)}
              className="flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-left hover:bg-surface-secondary transition-colors"
            >
              <div className="flex items-start gap-2.5">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="h-11 w-11 rounded-md object-cover shrink-0 bg-surface-tertiary"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-surface-tertiary shrink-0">
                    <ShoppingBasket className="h-4 w-4 text-text-tertiary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-semibold text-text-primary truncate">
                      {p.name}
                    </span>
                    {p.itemCode && (
                      <span className="text-[10px] text-text-tertiary shrink-0">
                        #{p.itemCode}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-text-tertiary">
                    <span className={`inline-flex rounded-full px-1.5 py-0.5 ${PHASE_COLORS[p.lifecyclePhase]}`}>
                      {PHASE_LABELS[p.lifecyclePhase]}
                    </span>
                    {p.description && (
                      <span className="truncate text-text-secondary">
                        {p.description.slice(0, 80)}
                        {p.description.length > 80 ? "…" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onRaiseFlag(p)}
              className="shrink-0 rounded-xl border border-border bg-surface px-3 text-[12px] font-medium text-text-secondary hover:bg-surface-secondary transition-colors inline-flex items-center gap-1.5"
              title="Raise flag"
            >
              <Flag className="h-3.5 w-3.5" />
              Flag
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
