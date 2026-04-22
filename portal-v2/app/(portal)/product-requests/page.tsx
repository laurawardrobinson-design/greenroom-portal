"use client";

import useSWR from "swr";
import Link from "next/link";
import { PackageSearch, Plus, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PRStatusPill } from "@/components/product-requests/pr-status-pill";
import type { PRDoc } from "@/types/domain";

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

function deptSummary(doc: PRDoc): string {
  if (doc.sections.length === 0) return "No departments";
  const labels: Record<string, string> = {
    Bakery: "Bakery",
    Produce: "Produce",
    Deli: "Deli",
    "Meat-Seafood": "Meat & Seafood",
    Grocery: "Grocery",
  };
  return doc.sections
    .map((s) => {
      const label = labels[s.department] ?? s.department;
      const count = s.items.length;
      return `${label} (${count})`;
    })
    .join(", ");
}

export default function ProductRequestsPage() {
  const { data: docs, isLoading } = useSWR<PRDoc[]>(
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
      <div className="flex items-center justify-between">
        <PageHeader title="Product Requests" />
        <Link
          href="/product-requests/new"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Request
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-surface-secondary animate-pulse" />
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
              <PackageSearch />
              {name}
            </CardTitle>
            <span className="text-sm text-text-tertiary">{wfNumber}</span>
          </CardHeader>
          <div className="divide-y divide-border">
            {campaignDocs.map((doc) => (
              <Link
                key={doc.id}
                href={`/product-requests/${doc.id}`}
                className="flex items-center gap-4 px-3.5 py-3 hover:bg-surface-secondary transition-colors group"
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {formatShootDate(doc.shootDate)}
                    </span>
                    <PRStatusPill status={doc.status} />
                    <span className="text-[11px] text-text-tertiary">{doc.docNumber}</span>
                  </div>
                  <p className="text-[11px] text-text-tertiary truncate">
                    {deptSummary(doc)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-text-tertiary group-hover:text-text-secondary transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
