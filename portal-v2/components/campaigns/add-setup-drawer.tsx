"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Crosshair } from "lucide-react";

export function AddSetupDrawer({
  open,
  onClose,
  campaignId,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast("error", "Scene name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/shot-list/setups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, name: name.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Scene added");
      reset();
      onAdded();
    } catch {
      toast("error", "Failed to add scene");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Crosshair className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">Scene</h2>
        </div>

        <Input
          label="Scene Name"
          placeholder="e.g., Hero shot on marble"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={saving}>
            Add Scene
          </Button>
        </div>
      </form>
    </Modal>
  );
}
