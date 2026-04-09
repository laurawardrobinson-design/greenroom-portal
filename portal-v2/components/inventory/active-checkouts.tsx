"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { GearCheckout } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ArrowUpFromLine, ArrowDownToLine, User, Calendar, Tag } from "lucide-react";
import { formatDistanceToNow, parseISO, format, isPast } from "date-fns";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ActiveCheckouts() {
  const { toast } = useToast();
  const { mutate: globalMutate } = useSWRConfig();
  const { data: checkouts = [], mutate } = useSWR<GearCheckout[]>(
    "/api/gear/checkouts",
    fetcher,
    {
      refreshInterval: 30000,
      onError: () => toast("error", "Failed to load active checkouts"),
    }
  );
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  async function handleCheckIn(co: GearCheckout) {
    setCheckingIn(co.id);
    try {
      const res = await fetch("/api/gear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkin_by_item",
          gearItemId: co.gearItemId,
          condition: "Good",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check-in failed");
      toast("success", `${co.gearItem?.name || "Item"} checked in`);
      mutate();
      globalMutate("/api/gear");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setCheckingIn(null);
    }
  }

  if (checkouts.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <ArrowUpFromLine className="h-4 w-4 shrink-0 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            CURRENTLY CHECKED OUT
          </h3>
        </div>
        <p className="text-sm text-text-secondary">
          All gear is available — nothing checked out.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <ArrowUpFromLine className="h-4 w-4 shrink-0 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
          CURRENTLY CHECKED OUT
        </h3>
        <Badge variant="default">{checkouts.length}</Badge>
      </div>
      <div className="divide-y divide-border-light max-h-72 overflow-y-auto">
        {checkouts.map((co) => (
          <div key={co.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50">
              <User className="h-3.5 w-3.5 text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {co.gearItem?.name || "Unknown item"}
              </p>
              <p className="text-xs text-text-tertiary">
                {co.user?.name || "Unknown"} ·{" "}
                {formatDistanceToNow(parseISO(co.checkedOutAt), {
                  addSuffix: true,
                })}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {co.campaignId && co.campaign && (
                  <span className="flex items-center gap-1 text-[10px] text-text-tertiary">
                    <Tag className="h-2.5 w-2.5" />
                    {co.campaign.wfNumber || co.campaign.name}
                  </span>
                )}
                {co.dueDate && (
                  <span className={`flex items-center gap-1 text-[10px] font-medium ${isPast(new Date(co.dueDate)) ? "text-red-600" : "text-text-tertiary"}`}>
                    <Calendar className="h-2.5 w-2.5" />
                    Due {format(new Date(co.dueDate), "MMM d")}
                    {isPast(new Date(co.dueDate)) && " — overdue"}
                  </span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              loading={checkingIn === co.id}
              onClick={() => handleCheckIn(co)}
              className="shrink-0 text-text-tertiary hover:text-text-primary"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              Check In
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
