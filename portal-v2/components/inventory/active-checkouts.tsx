"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { GearCheckout } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ArrowUpFromLine, ArrowDownToLine, User } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

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
          <ArrowUpFromLine className="h-4 w-4 text-text-tertiary" />
          <h3 className="text-sm font-semibold text-text-primary">
            Currently Checked Out
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
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <ArrowUpFromLine className="h-4 w-4 text-text-tertiary" />
        <h3 className="text-sm font-semibold text-text-primary">
          Currently Checked Out
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
