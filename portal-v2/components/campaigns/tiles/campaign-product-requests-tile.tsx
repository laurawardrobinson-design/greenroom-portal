"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { PackageSearch, Plus, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PRStatusPill } from "@/components/product-requests/pr-status-pill";
import { PRDocDrawer } from "@/components/product-requests/pr-doc-drawer";
import type { PRDoc, AppUser } from "@/types/domain";

async function fetcher<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Failed");
  return r.json() as Promise<T>;
}

interface Props {
  campaignId: string;
  user: AppUser | null;
  shootDates?: { id: string; shoot_date: string; shoot_name?: string }[];
}

const CAN_REQUEST_ROLES = ["Admin", "Producer", "Post Producer", "Brand Marketing Manager"];

function formatShootDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CampaignProductRequestsTile({ campaignId, user }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: docs, mutate } = useSWR<PRDoc[]>(
    `/api/product-requests?campaignId=${campaignId}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const items = docs ?? [];
  const canRequest = user && CAN_REQUEST_ROLES.includes(user.role);

  return (
    <>
      <Card padding="none" className="overflow-hidden">
        <CardHeader>
          <CardTitle>
            <PackageSearch />
            Product Requests
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-normal text-text-tertiary normal-case tracking-normal">
              {items.length === 0
                ? "none yet"
                : `${items.length} ${items.length === 1 ? "request" : "requests"}`}
            </span>
            {canRequest && (
              <button
                onClick={() => router.push(`/product-requests/new?campaign=${campaignId}`)}
                className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-sm text-text-secondary hover:bg-surface-secondary transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New Request
              </button>
            )}
          </div>
        </CardHeader>

        {items.length === 0 ? (
          <div className="px-3.5 py-4 text-sm text-text-tertiary">
            No product requests yet. Create one to start planning what you need from the RBU.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((doc) => (
              <button
                key={doc.id}
                onClick={() => setSelectedId(doc.id)}
                className="flex w-full items-center gap-3 px-3.5 py-3 hover:bg-surface-secondary transition-colors group text-left"
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {formatShootDate(doc.shootDate)}
                    </span>
                    <PRStatusPill status={doc.status} />
                  </div>
                  <p className="text-[11px] text-text-tertiary">
                    {doc.sections.length > 0
                      ? doc.sections.map((s) => s.department === "Meat-Seafood" ? "Meat & Seafood" : s.department).join(", ")
                      : doc.docNumber}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-text-tertiary group-hover:text-text-secondary transition-colors shrink-0" />
              </button>
            ))}
          </div>
        )}
      </Card>

      <PRDocDrawer
        id={selectedId}
        onClose={() => { setSelectedId(null); mutate(); }}
      />
    </>
  );
}
