"use client";

import { useState } from "react";
import useSWR from "swr";
import type { GearKit } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  Star,
  ChevronDown,
  ChevronRight,
  Layers,
  ArrowUpFromLine,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_BADGE: Record<string, string> = {
  Available: "bg-emerald-50 text-success",
  "Checked Out": "bg-amber-50 text-warning",
  Reserved: "bg-blue-50 text-blue-700",
  "Under Maintenance": "bg-purple-50 text-purple-700",
};

export function FavoriteKits() {
  const { toast } = useToast();
  const { data: kits = [], mutate } = useSWR<GearKit[]>(
    "/api/gear/kits",
    fetcher
  );
  const [expandedKit, setExpandedKit] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  const favoriteKits = kits.filter((k) => k.isFavorite);

  if (favoriteKits.length === 0) return null;

  async function handleCheckoutKit(kitId: string) {
    setCheckingOut(kitId);
    try {
      const res = await fetch("/api/gear/kits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkout_kit", kitId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to check out kit");
      const outCount = result.checkedOut?.length || 0;
      const skipCount = result.alreadyOut?.length || 0;
      if (outCount > 0) {
        toast(
          "success",
          skipCount > 0
            ? `Checked out ${outCount} item${outCount !== 1 ? "s" : ""} — ${skipCount} already out`
            : `Checked out ${outCount} item${outCount !== 1 ? "s" : ""}`
        );
      } else {
        toast("info", "All items in this kit are already checked out");
      }
      mutate();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to check out kit");
    } finally {
      setCheckingOut(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
        <h3 className="text-sm font-semibold text-text-primary">
          Favorite Kits
        </h3>
      </div>
      <div className="divide-y divide-border-light">
        {favoriteKits.map((kit) => {
          const availableCount =
            kit.items?.filter((i) => i.status === "Available").length || 0;
          const totalCount = kit.items?.length || 0;
          const allOut = availableCount === 0 && totalCount > 0;
          const expanded = expandedKit === kit.id;

          return (
            <div key={kit.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setExpandedKit(expanded ? null : kit.id)
                  }
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  {expanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {kit.name}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {totalCount} items · {availableCount} available
                    </p>
                  </div>
                </button>
                <Button
                  size="sm"
                  variant={allOut ? "ghost" : "primary"}
                  disabled={allOut}
                  loading={checkingOut === kit.id}
                  onClick={() => handleCheckoutKit(kit.id)}
                >
                  <ArrowUpFromLine className="h-3.5 w-3.5" />
                  {allOut ? "All out" : "Check Out Kit"}
                </Button>
              </div>
              {expanded && kit.items && (
                <div className="mt-2 ml-5.5 space-y-1">
                  {kit.items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 text-xs rounded-md px-2 py-1.5 ${
                        item.status !== "Available"
                          ? "opacity-50"
                          : ""
                      }`}
                    >
                      <Badge
                        variant="custom"
                        className={
                          STATUS_BADGE[item.status] ||
                          "bg-slate-100 text-slate-600"
                        }
                      >
                        {item.status}
                      </Badge>
                      <span className="text-text-primary font-medium">
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
