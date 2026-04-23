"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { GearItem } from "@/types/domain";

export function CreateKitModal({
  open,
  onClose,
  items,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  items: GearItem[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFavorite, setIsFavorite] = useState(false);

  function toggleItem(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast("error", "Name is required");
      return;
    }
    if (selectedIds.size === 0) {
      toast("error", "Select at least one item");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/gear/kits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          itemIds: [...selectedIds],
          isFavorite,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create kit");
      toast("success", "Kit created");
      setName("");
      setDescription("");
      setSelectedIds(new Set());
      setIsFavorite(false);
      onCreated();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to create kit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Gear Kit" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Kit Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g., Standard Food Photo Setup"
        />
        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this kit is typically used for"
        />
        <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
          <input
            type="checkbox"
            checked={isFavorite}
            onChange={(e) => setIsFavorite(e.target.checked)}
            className="rounded border-border text-primary"
          />
          <Star className="h-3.5 w-3.5 text-amber-500" />
          Mark as favorite
        </label>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Items ({selectedIds.size} selected)
          </label>
          <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
            {items.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-surface-secondary transition-colors cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleItem(item.id)}
                  className="rounded border-border text-primary"
                />
                <span className="text-text-primary font-medium">
                  {item.name}
                </span>
                <span className="text-text-tertiary text-xs">
                  {item.brand} {item.model}
                </span>
              </label>
            ))}
          </div>
        </div>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Create Kit
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
