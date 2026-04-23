"use client";

import { useState, useEffect } from "react";
import { Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { GearItem, GearKit } from "@/types/domain";

export function EditKitModal({
  kit,
  open,
  onClose,
  items,
  onUpdated,
  onDeleted,
}: {
  kit: GearKit | null;
  open: boolean;
  onClose: () => void;
  items: GearItem[];
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (kit) {
      setName(kit.name);
      setDescription(kit.description || "");
      setIsFavorite(kit.isFavorite);
      setSelectedIds(new Set(kit.items?.map((i) => i.id) || []));
      setConfirmDelete(false);
    }
  }, [kit]);

  if (!kit) return null;

  // kit is non-null beyond this point
  const kitId = kit.id;
  const kitName = kit.name;
  const originalIds = new Set(kit.items?.map((i) => i.id) || []);

  function toggleItem(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast("error", "Name is required");
      return;
    }
    if (selectedIds.size === 0) {
      toast("error", "Select at least one item");
      return;
    }

    const addItemIds = [...selectedIds].filter((id) => !originalIds.has(id));
    const removeItemIds = [...originalIds].filter((id) => !selectedIds.has(id));

    setSaving(true);
    try {
      const res = await fetch(`/api/gear/kits?id=${kitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          isFavorite,
          addItemIds: addItemIds.length ? addItemIds : undefined,
          removeItemIds: removeItemIds.length ? removeItemIds : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update kit");
      toast("success", "Kit updated");
      onUpdated();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to update kit");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/gear/kits?id=${kitId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete kit");
      toast("success", `${kitName} deleted`);
      onDeleted();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to delete kit");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Kit" size="lg">
      <form onSubmit={handleSave} className="space-y-4">
        <Input
          label="Kit Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
          <input
            type="checkbox"
            checked={isFavorite}
            onChange={(e) => setIsFavorite(e.target.checked)}
            className="rounded border-border text-primary"
          />
          <Star className="h-3.5 w-3.5 text-amber-500" />
          Show in Favorite Kits
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
                <span className="text-text-primary font-medium">{item.name}</span>
                <span className="text-text-tertiary text-xs">
                  {item.brand} {item.model}
                </span>
              </label>
            ))}
          </div>
        </div>
        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            loading={deleting}
            onClick={handleDelete}
            className={confirmDelete ? "text-error hover:text-error" : "text-text-tertiary"}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirmDelete ? "Confirm Delete?" : "Delete Kit"}
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save Changes
            </Button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
