"use client";

import Link from "next/link";
import useSWR from "swr";
import { FilePen, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PRStatusPill } from "@/components/product-requests/pr-status-pill";
import type { PRDoc } from "@/types/domain";

async function fetcher<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Failed");
  return r.json() as Promise<T>;
}

function formatShootDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function RailInProgressRequests() {
  const { data } = useSWR<PRDoc[]>(
    "/api/product-requests?status=draft",
    fetcher,
    { refreshInterval: 30000 }
  );
  const items = (data ?? []).slice(0, 5);

  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader>
        <CardTitle>
          <FilePen />
          Drafts
        </CardTitle>
        <Link
          href="/product-requests"
          className="text-[13px] font-normal text-text-tertiary normal-case tracking-normal hover:text-primary"
        >
          {items.length === 0 ? "none" : `${items.length} drafts · view all`}
        </Link>
      </CardHeader>

      {items.length === 0 ? (
        <div className="px-3.5 py-4 text-sm text-text-tertiary">
          No drafts on the floor.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {items.map((doc) => (
            <Link
              key={doc.id}
              href={`/product-requests/${doc.id}`}
              className="flex items-center gap-3 px-3.5 py-3 hover:bg-surface-secondary transition-colors group"
            >
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary truncate">
                    {doc.campaign?.name ?? "Campaign"}
                  </span>
                  <PRStatusPill status={doc.status} />
                </div>
                <p className="text-[11px] text-text-tertiary">
                  {doc.campaign?.wfNumber} · Shoot {formatShootDate(doc.shootDate)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-text-tertiary group-hover:text-text-secondary shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
