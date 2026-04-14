"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useSWRConfig } from "swr";
import type { EditRoom } from "@/types/domain";

interface Props {
  open: boolean;
  onClose: () => void;
  rooms: EditRoom[];
  campaigns: Array<{ id: string; wfNumber: string; name: string }>;
  defaultRoomId?: string;
  defaultDate?: string;
}

export function ReserveRoomModal({ open, onClose, rooms, campaigns, defaultRoomId, defaultDate }: Props) {
  const { toast } = useToast();
  const { mutate } = useSWRConfig();

  const [roomId, setRoomId] = useState(defaultRoomId ?? "");
  const [campaignId, setCampaignId] = useState("");
  const [editorName, setEditorName] = useState("");
  const [startDate, setStartDate] = useState(defaultDate ?? "");
  const [endDate, setEndDate] = useState(defaultDate ?? "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setRoomId(defaultRoomId ?? "");
    setCampaignId("");
    setEditorName("");
    setStartDate(defaultDate ?? "");
    setEndDate(defaultDate ?? "");
    setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId || !editorName || !startDate || !endDate) {
      toast("error", "Room, editor name, start date and end date are required.");
      return;
    }
    if (endDate < startDate) {
      toast("error", "End date must be on or after start date.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/post-workflow/edit-room-reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          campaignId: campaignId || null,
          editorName,
          startDate,
          endDate,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast("error", data.error ?? "Failed to reserve room.");
        return;
      }
      toast("success", "Room reserved successfully.");
      mutate((key: string) => typeof key === "string" && key.startsWith("/api/post-workflow/edit-room-reservations"), undefined, { revalidate: true });
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const roomOptions = [
    { value: "", label: "Select room…" },
    ...rooms.map((r) => ({ value: r.id, label: r.name })),
  ];

  const campaignOptions = [
    { value: "", label: "No campaign" },
    ...campaigns.map((c) => ({ value: c.id, label: `${c.wfNumber} — ${c.name}` })),
  ];

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Reserve Edit Room">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">Room</label>
          <Select
            options={roomOptions}
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">Editor Name</label>
          <Input
            placeholder="Editor name"
            value={editorName}
            onChange={(e) => setEditorName(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">Campaign (optional)</label>
          <Select
            options={campaignOptions}
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (endDate < e.target.value) setEndDate(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">End Date</label>
            <Input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">Notes (optional)</label>
          <textarea
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            rows={2}
            placeholder="Any special notes…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button variant="ghost" type="button" onClick={() => { reset(); onClose(); }}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? "Reserving…" : "Reserve Room"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
