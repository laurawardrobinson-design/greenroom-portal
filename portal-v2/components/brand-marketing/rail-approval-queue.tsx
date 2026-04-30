"use client";

import useSWR from "swr";
import { ClipboardCheck, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ApprovalStatePill } from "./approval-state-pill";
import {
  daysAging,
  type BrandApprovalQueueItem,
} from "@/lib/services/brand-approvals.service";

async function fetcher(url: string): Promise<BrandApprovalQueueItem[]> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

export function RailApprovalQueue() {
  const { data: queue, isLoading } = useSWR<BrandApprovalQueueItem[]>(
    "/api/brand-approvals?assignedTo=me",
    fetcher,
    { refreshInterval: 30000 }
  );

  const items = queue ?? [];
  const aging = items.filter((a) => daysAging(a.createdAt) >= 2).length;

  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader>
        <CardTitle>
          <ClipboardCheck />
          <span>Brand reviews awaiting follow-up</span>
        </CardTitle>
        <span className="text-[13px] font-normal text-text-tertiary normal-case tracking-normal">
          {items.length === 0
            ? "none open"
            : aging > 0
              ? `${items.length} open · ${aging} aging`
              : `${items.length} open`}
        </span>
      </CardHeader>

      {isLoading ? null : items.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-text-primary font-medium">
            No open reviews right now.
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            When you leave a brand review flagged for changes, it stays here until
            the producer updates and you re-approve.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((a) => {
            const age = daysAging(a.createdAt);
            return (
              <li key={a.id}>
                <div className="flex w-full items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
                        {a.subjectLabel}
                      </span>
                      {age >= 2 && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset"
                          style={{
                            color: "var(--status-pending-fg)",
                            backgroundColor: "var(--status-pending-tint)",
                            boxShadow: "inset 0 0 0 1px var(--status-pending-border)",
                          }}
                        >
                          <Clock className="h-3 w-3" />
                          {age}d
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm font-medium text-text-primary truncate">
                      {a.campaignName}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-text-tertiary">
                      <span>{a.campaignWfNumber}</span>
                    </div>
                    {a.comment && (
                      <p className="mt-1.5 text-sm text-text-secondary line-clamp-2">
                        {a.comment}
                      </p>
                    )}
                  </div>
                  <ApprovalStatePill state={a.state} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
