"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { CHANNEL_PRESETS, UNIQUE_CHANNELS } from "@/lib/constants/channels";

export function AddDeliverableModal({
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
  const [channel, setChannel] = useState("Instagram");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);

  const presets = CHANNEL_PRESETS.filter((p) => p.channel === channel);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const preset = CHANNEL_PRESETS.find(
      (p) => p.channel === channel && p.format === selectedPreset
    );
    if (!preset) {
      toast("error", "Select a format");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/deliverables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          channel: preset.channel,
          format: preset.format,
          width: preset.width,
          height: preset.height,
          aspectRatio: preset.aspectRatio,
          quantity,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Deliverable added");
      onAdded();
    } catch {
      toast("error", "Failed to add deliverable");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Deliverable">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Channel"
          value={channel}
          onChange={(e) => { setChannel(e.target.value); setSelectedPreset(""); }}
          options={UNIQUE_CHANNELS.map((c) => ({ value: c, label: c }))}
        />
        <Select
          label="Format"
          value={selectedPreset}
          onChange={(e) => setSelectedPreset(e.target.value)}
          placeholder="Select format..."
          options={presets.map((p) => ({
            value: p.format,
            label: `${p.format} (${p.width}x${p.height})`,
          }))}
        />
        <Input
          label="Quantity"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Add Deliverable
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
