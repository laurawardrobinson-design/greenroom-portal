"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { PackageCheck, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PRStatusPill } from "@/components/product-requests/pr-status-pill";
import { PRDocDrawer } from "@/components/product-requests/pr-doc-drawer";
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

export function RailFormalRequests() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, mutate } = useSWR<PRDoc[]>(
    "/api/product-requests?status=submitted,forwarded",
    fetcher,
    { refreshInterval: 60000 }
  );
  const items = (data ?? []).filter((d) => d.status === "submitted").slice(0, 5);

  return (
    <>
      <Card padding="none" className="overflow-hidden">
        <CardHeader>
          <CardTitle>
            <PackageCheck />
            Product Requests
          </CardTitle>
          <Link
            href="/product-requests"
            className="text-[13px] font-normal text-text-tertiary normal-case tracking-normal hover:text-primary"
          >
            {items.length === 0 ? "none awaiting" : `${items.length} awaiting · view all`}
          </Link>
        </CardHeader>

        {items.length === 0 ? (
          <div className="px-3.5 py-4 text-sm text-text-tertiary">
            Nothing submitted yet. When a Producer submits a request, it lands here.
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
