"use client";

import { useState } from "react";
import useSWR from "swr";
import { Input } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import { Wrench, Plus } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function LinkGearDrawer({
  open,
  onClose,
  campaignId,
  onLinked,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  onLinked: () => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const { data: items = [] } = useSWR(
    open ? `/api/gear${search ? `?search=${encodeURIComponent(search)}` : ""}` : null,
    fetcher
  );
  const [linking, setLinking] = useState<string | null>(null);

  async function linkGear(gearItemId: string) {
    setLinking(gearItemId);
    try {
      const res = await fetch("/api/campaign-gear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, gearItemId }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Gear linked");
      onLinked();
    } catch {
      toast("error", "Failed to link gear");
    } finally {
      setLinking(null);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Add Gear">
      <div className="space-y-4">
        <Input
          placeholder="Search gear..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {items.map((item: { id: string; name: string; category: string; brand: string; model: string; status: string }) => (
            <button
              key={item.id}
              onClick={() => linkGear(item.id)}
              disabled={linking === item.id}
              className="flex w-full items-center gap-3 rounded-lg bg-surface-secondary p-3 text-left hover:bg-surface-tertiary transition-colors disabled:opacity-50"
            >
              <Wrench className="h-4 w-4 text-text-tertiary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{item.name}</p>
                <p className="text-xs text-text-tertiary">{item.category}{item.brand ? ` · ${item.brand}` : ""}{item.model ? ` ${item.model}` : ""}</p>
              </div>
              <Plus className="h-4 w-4 text-text-secondary" />
            </button>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-text-tertiary text-center py-8">
              {search ? "No gear found" : "No gear in inventory yet"}
            </p>
          )}
        </div>
      </div>
    </Drawer>
  );
}
