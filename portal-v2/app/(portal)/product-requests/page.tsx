"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Apple,
  Beef,
  CalendarDays,
  ChevronRight,
  Clock,
  Cookie,
  Package,
  PackageSearch,
  Plus,
  Sandwich,
  ShoppingBasket,
  type LucideIcon,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PRStatusPill } from "@/components/product-requests/pr-status-pill";
import { PRDocDrawer } from "@/components/product-requests/pr-doc-drawer";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { PRDoc, PRDepartment, PRDeptSection } from "@/types/domain";
import { PR_DEPARTMENT_LABELS } from "@/types/domain";

const DEPT_ICONS: Record<PRDepartment, LucideIcon> = {
  Bakery: Cookie,
  Produce: Apple,
  Deli: Sandwich,
  "Meat-Seafood": Beef,
  Grocery: ShoppingBasket,
};

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json() as Promise<T>;
}

function formatShootDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(hhmm: string) {
  if (!hhmm || !/^\d{1,2}:\d{2}/.test(hhmm)) return hhmm;
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  const period = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function earliestPickupTime(sections: PRDeptSection[]): string | null {
  const candidates = sections
    .filter((s) => s.dateNeeded && s.timeNeeded)
    .map((s) => `${s.dateNeeded}T${s.timeNeeded}`)
    .sort();
  if (candidates.length === 0) return null;
  const first = candidates[0];
  return first.slice(11, 16);
}

function DeptChips({ sections }: { sections: PRDeptSection[] }) {
  const active = sections.filter((s) => s.items.length > 0);
  if (active.length === 0) {
    return (
      <span className="text-[11px] text-text-tertiary italic">No items yet</span>
    );
  }
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {active.map((s) => {
        const Icon = DEPT_ICONS[s.department];
        return (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-0.5 text-[11px] text-text-secondary"
            title={`${PR_DEPARTMENT_LABELS[s.department]} · ${s.items.length} item${s.items.length === 1 ? "" : "s"}`}
          >
            <Icon className="h-3 w-3 text-primary" />
            <span>{PR_DEPARTMENT_LABELS[s.department]}</span>
            <span className="text-text-tertiary tabular-nums">{s.items.length}</span>
          </span>
        );
      })}
    </div>
  );
}

export default function ProductRequestsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { user } = useCurrentUser();
  const isBMM =
    user?.role === "Brand Marketing Manager" || user?.role === "Admin";

  const { data: docs, isLoading, mutate } = useSWR<PRDoc[]>(
    "/api/product-requests",
    fetcher,
    { refreshInterval: 30000 }
  );

  // Group by campaign
  const byCampaign = new Map<string, { name: string; wfNumber: string; docs: PRDoc[] }>();
  for (const doc of docs ?? []) {
    const key = doc.campaignId;
    if (!byCampaign.has(key)) {
      byCampaign.set(key, {
        name: doc.campaign?.name ?? "Unknown Campaign",
        wfNumber: doc.campaign?.wfNumber ?? "",
        docs: [],
      });
    }
    byCampaign.get(key)!.docs.push(doc);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <PageHeader title="Product Requests" />
        <div className="flex items-center gap-2">
          {isBMM && (
            <Link
              href="/product-requests/calendar"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              <CalendarDays className="h-4 w-4" />
              Calendar
            </Link>
          )}
          <Link
            href="/product-requests/new"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Request
          </Link>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-surface-secondary animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && byCampaign.size === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <PackageSearch className="h-10 w-10 text-text-tertiary" />
          <p className="text-sm text-text-secondary">No product requests yet.</p>
          <Link
            href="/product-requests/new"
            className="text-sm text-primary hover:underline"
          >
            Create your first request
          </Link>
        </div>
      )}

      {Array.from(byCampaign.entries()).map(([campaignId, { name, wfNumber, docs: campaignDocs }]) => (
        <Card key={campaignId} padding="none">
          <CardHeader>
            <CardTitle>
              <Package />
              {name}
            </CardTitle>
            <span className="text-[11px] font-medium text-text-tertiary tracking-wide">{wfNumber}</span>
          </CardHeader>
          <div className="divide-y divide-border">
            {campaignDocs.map((doc) => {
              const totalItems = doc.sections.reduce((n, s) => n + s.items.length, 0);
              const pickup = earliestPickupTime(doc.sections);
              return (
                <button
                  key={doc.id}
                  onClick={() => setSelectedId(doc.id)}
                  className="flex w-full items-start gap-4 px-3.5 py-3 hover:bg-surface-secondary transition-colors group text-left"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Row 1: shoot date + status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                        <CalendarDays className="h-3.5 w-3.5 text-text-tertiary" />
                        {formatShootDate(doc.shootDate)}
                      </span>
                      <PRStatusPill status={doc.status} />
                      <span className="text-[11px] text-text-tertiary tabular-nums">{doc.docNumber}</span>
                    </div>

                    {/* Row 2: dept chips */}
                    <DeptChips sections={doc.sections} />

                    {/* Row 3: item count + earliest pickup */}
                    {totalItems > 0 && (
                      <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-[11px] text-text-tertiary">
                        <span className="tabular-nums">
                          {totalItems} {totalItems === 1 ? "item" : "items"}
                        </span>
                        {pickup && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Earliest pickup {formatTime(pickup)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-text-tertiary group-hover:text-text-secondary transition-colors shrink-0 mt-1" />
                </button>
              );
            })}
          </div>
        </Card>
      ))}

      <PRDocDrawer
        id={selectedId}
        onClose={() => { setSelectedId(null); mutate(); }}
      />
    </div>
  );
}
