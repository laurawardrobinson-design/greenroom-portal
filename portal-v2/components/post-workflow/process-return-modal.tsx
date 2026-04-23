"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { DriveCheckoutSession, DriveCheckoutItem } from "@/types/domain";
import { DRIVE_CONDITIONS, BACKUP_LOCATIONS } from "@/lib/constants/edit-rooms";
import { HardDrive, CheckCircle2, Lock, AlertCircle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  session: DriveCheckoutSession;
  item: DriveCheckoutItem;
  onSuccess: () => void;
}

export function ProcessReturnModal({ open, onClose, session, item, onSuccess }: Props) {
  const { toast } = useToast();

  const isMediaManager = item.checkoutRole === "media_manager";
  const isShooter = item.checkoutRole === "shooter";

  // For shooter: check if media manager drive has been returned and backup confirmed
  const mmItem = session.items?.find((i) => i.checkoutRole === "media_manager");
  const backupConfirmed = mmItem?.dataOffloadedBackedUp && mmItem?.returnedAt;

  const [conditionIn, setConditionIn] = useState("Good");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [dataOffloaded, setDataOffloaded] = useState(false);
  const [backupLocation, setBackupLocation] = useState("ShareBrowser");
  const [driveWiped, setDriveWiped] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const conditionOptions = DRIVE_CONDITIONS.map((c) => ({ value: c, label: c }));
  const backupOptions = BACKUP_LOCATIONS.map((b) => ({ value: b, label: b }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isMediaManager && !dataOffloaded) {
      toast("error", "Please confirm data has been offloaded and backed up before processing this return.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/post-workflow/drive-checkouts/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          conditionIn,
          actualReturnDate: returnDate,
          dataOffloadedBackedUp: dataOffloaded,
          backupLocation: isMediaManager ? backupLocation : null,
          driveWiped: isShooter ? driveWiped : false,
          clearForReuse: isShooter && driveWiped,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast("error", d.error ?? "Failed to process return.");
        return;
      }
      toast("success", isMediaManager ? "Drive returned — backup confirmed." : "Drive returned and cleared for reuse.");
      onClose();
      onSuccess();
    } finally {
      setSaving(false);
    }
  }

  // Shooter locked until media manager return + backup confirmed
  const shooterLocked = isShooter && !backupConfirmed;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Process Return — ${isMediaManager ? "Media Manager" : "Shooter"} Drive`}
    >
      {/* Campaign context */}
      {session.campaign && (
        <div className="mb-4 rounded-lg border border-border bg-surface-secondary p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Campaign</p>
          <p className="mt-0.5 text-sm font-semibold text-text-primary">
            {session.campaign.wfNumber} — {session.campaign.name}
          </p>
          {session.shootDate && (
            <p className="mt-0.5 text-xs text-text-secondary">
              Shoot: {format(parseISO(session.shootDate), "MMM d, yyyy")}
            </p>
          )}
        </div>
      )}

      {/* Drive info */}
      <div className={`mb-4 flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
        isMediaManager ? "border-violet-200 bg-violet-50" : "border-blue-200 bg-blue-50"
      }`}>
        <HardDrive className={`h-5 w-5 shrink-0 ${isMediaManager ? "text-violet-600" : "text-blue-600"}`} />
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {item.drive?.brand} {item.drive?.model ?? ""} · {item.drive?.storageSize}
          </p>
          <p className="text-xs text-text-secondary">
            <span className={`font-medium ${isMediaManager ? "text-violet-600" : "text-blue-600"}`}>
              {isMediaManager ? "Media Manager Drive" : "Shooter Drive"}
            </span>
            {" · "}Checked out in {item.conditionOut} condition
          </p>
        </div>
      </div>

      {/* Shooter locked state */}
      {shooterLocked && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Waiting for backup confirmation</p>
            <p className="mt-0.5 text-xs text-amber-700">
              The media manager drive must be returned with backup confirmed before the shooter drive can be returned.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Condition */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">Condition on Return</label>
          <Select options={conditionOptions} value={conditionIn} onChange={(e) => setConditionIn(e.target.value)} />
        </div>

        {/* Return date */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">Actual Return Date</label>
          <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
        </div>

        {/* Media manager: backup fields */}
        {isMediaManager && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">Backup Location</label>
              <Select options={backupOptions} value={backupLocation} onChange={(e) => setBackupLocation(e.target.value)} />
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-surface-secondary">
              <input
                type="checkbox"
                checked={dataOffloaded}
                onChange={(e) => setDataOffloaded(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
              />
              <div>
                <p className="text-sm font-medium text-text-primary">Data offloaded & backed up</p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Confirm all footage from this drive has been fully backed up to {backupLocation}
                </p>
              </div>
            </label>
            {dataOffloaded && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Backup confirmed — shooter drive will be unlocked for return.
              </div>
            )}
          </>
        )}

        {/* Shooter: wipe confirmation */}
        {isShooter && !shooterLocked && (
          <>
            {mmItem?.returnedAt && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Backup confirmed on {mmItem.returnedAt ? format(parseISO(mmItem.returnedAt), "MMM d, yyyy") : "—"}
                {mmItem.backupLocation ? ` via ${mmItem.backupLocation}` : ""}
              </div>
            )}
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-surface-secondary">
              <input
                type="checkbox"
                checked={driveWiped}
                onChange={(e) => setDriveWiped(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
              />
              <div>
                <p className="text-sm font-medium text-text-primary">Drive wiped & ready for reuse</p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Confirm drive has been securely erased and is clear for future checkout
                </p>
              </div>
            </label>
          </>
        )}

        {/* Notes */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">Notes (optional)</label>
          <textarea
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none"
            rows={2}
            placeholder={isMediaManager ? "e.g. Minor read error on card 3, recovered successfully" : "Any notes about the drive condition…"}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            type="submit"
            disabled={saving || shooterLocked}
          >
            {saving ? "Processing…" : "Process Return"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
