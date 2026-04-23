"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { MediaDrive } from "@/types/domain";
import { DRIVE_SIZES, DRIVE_CONDITIONS } from "@/lib/constants/edit-rooms";
import { HardDrive, RefreshCw, AlertCircle } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); });

interface Props {
  open: boolean;
  onClose: () => void;
  campaigns: Array<{ id: string; wfNumber: string; name: string }>;
  onSuccess: () => void;
}

type Step = 1 | 2 | 3;

export function CheckoutDrivesModal({ open, onClose, campaigns, onSuccess }: Props) {
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [campaignId, setCampaignId] = useState("");
  const [shootDate, setShootDate] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [notes, setNotes] = useState("");
  const [sizeNeeded, setSizeNeeded] = useState("2 TB");
  const [shooterDriveId, setShooterDriveId] = useState("");
  const [mmDriveId, setMmDriveId] = useState("");
  const [shooterCondition, setShooterCondition] = useState("Good");
  const [mmCondition, setMmCondition] = useState("Good");
  const [saving, setSaving] = useState(false);

  // Auto-suggest drives when size changes
  const [suggestUrl, setSuggestUrl] = useState<string | null>(null);
  const { data: suggested } = useSWR<MediaDrive[]>(suggestUrl, fetcher);

  // Available drives of selected size for manual override
  const availableUrl = open && step === 2
    ? `/api/post-workflow/drives?status=Available&size=${encodeURIComponent(sizeNeeded)}`
    : null;
  const { data: availableDrives } = useSWR<MediaDrive[]>(availableUrl, fetcher);
  const avail = Array.isArray(availableDrives) ? availableDrives : [];

  useEffect(() => {
    if (step === 2 && sizeNeeded) {
      setSuggestUrl(`/api/post-workflow/drive-checkouts?suggest=true&size=${encodeURIComponent(sizeNeeded)}`);
    }
  }, [step, sizeNeeded]);

  useEffect(() => {
    if (suggested && suggested.length >= 2) {
      setShooterDriveId(suggested[0].id);
      setMmDriveId(suggested[1].id);
    }
  }, [suggested]);

  function reset() {
    setStep(1);
    setCampaignId("");
    setShootDate("");
    setExpectedReturn("");
    setNotes("");
    setSizeNeeded("2 TB");
    setShooterDriveId("");
    setMmDriveId("");
    setShooterCondition("Good");
    setMmCondition("Good");
  }

  function driveLabel(d: MediaDrive) {
    return `${d.brand} ${d.model ?? ""} · ${d.storageSize} · ${d.condition}`;
  }

  function pairingMessage() {
    const s = avail.find((d) => d.id === shooterDriveId);
    const m = avail.find((d) => d.id === mmDriveId);
    if (!s || !m) return null;
    const sameBrand = s.brand === m.brand;
    return sameBrand
      ? `Matched: ${s.brand} + ${m.brand} — same brand`
      : `Mixed brands: ${s.brand} + ${m.brand} (no two ${sizeNeeded} same brand available)`;
  }

  async function handleSubmit() {
    if (!shooterDriveId || !mmDriveId) {
      toast("error", "Select both drives before confirming.");
      return;
    }
    if (shooterDriveId === mmDriveId) {
      toast("error", "Shooter and media manager drives must be different.");
      return;
    }
    setSaving(true);
    try {
      const camp = campaigns.find((c) => c.id === campaignId);
      const res = await fetch("/api/post-workflow/drive-checkouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campaignId || null,
          projectDisplayName: camp ? `${camp.wfNumber} ${camp.name}` : null,
          shootDate: shootDate || null,
          expectedReturnDate: expectedReturn || null,
          notes: notes || null,
          drives: [
            { driveId: shooterDriveId, role: "shooter", conditionOut: shooterCondition },
            { driveId: mmDriveId, role: "media_manager", conditionOut: mmCondition },
          ],
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast("error", d.error ?? "Checkout failed.");
        return;
      }
      toast("success", "Drives checked out successfully.");
      reset();
      onClose();
      onSuccess();
    } finally {
      setSaving(false);
    }
  }

  const campaignOptions = [
    { value: "", label: "No campaign" },
    ...campaigns.map((c) => ({ value: c.id, label: `${c.wfNumber} — ${c.name}` })),
  ];

  const sizeOptions = DRIVE_SIZES.map((s) => ({ value: s, label: s }));
  const conditionOptions = DRIVE_CONDITIONS.map((c) => ({ value: c, label: c }));
  const driveOptions = (excludeId: string) => [
    { value: "", label: "Select drive…" },
    ...avail.filter((d) => d.id !== excludeId).map((d) => ({ value: d.id, label: driveLabel(d) })),
  ];

  const shooterDrive = avail.find((d) => d.id === shooterDriveId);
  const mmDrive = avail.find((d) => d.id === mmDriveId);
  const selectedCampaign = campaigns.find((c) => c.id === campaignId);

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Check Out Drives">
      {/* Step indicator */}
      <div className="mb-5 flex items-center gap-2">
        {([1, 2, 3] as Step[]).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                step === s
                  ? "bg-primary text-white"
                  : step > s
                  ? "bg-emerald-500 text-white"
                  : "bg-surface-secondary text-text-tertiary"
              }`}
            >
              {step > s ? "✓" : s}
            </div>
            {s < 3 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
        <span className="ml-2 text-xs text-text-tertiary">
          {step === 1 ? "Campaign & Shoot" : step === 2 ? "Drive Pairing" : "Confirm"}
        </span>
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Campaign (optional)</label>
            <Select options={campaignOptions} value={campaignId} onChange={(e) => setCampaignId(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Shoot Date</label>
            <Input type="date" value={shootDate} onChange={(e) => setShootDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Expected Return Date</label>
            <Input type="date" value={expectedReturn} min={shootDate} onChange={(e) => setExpectedReturn(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Notes (optional)</label>
            <textarea
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
            <Button variant="primary" onClick={() => setStep(2)}>Next</Button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Drive Size Needed</label>
            <Select options={sizeOptions} value={sizeNeeded} onChange={(e) => { setSizeNeeded(e.target.value); setShooterDriveId(""); setMmDriveId(""); }} />
          </div>

          {pairingMessage() && (
            <p className="rounded-md bg-surface-secondary px-3 py-2 text-xs text-text-secondary">
              {pairingMessage()}
            </p>
          )}

          {avail.length < 2 && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Less than 2 drives of this size are available. Consider a different size.
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">
                <span className="mr-1.5 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-700">Shooter</span>
                Drive (stays with shooter)
              </label>
              <Select
                options={driveOptions(mmDriveId)}
                value={shooterDriveId}
                onChange={(e) => setShooterDriveId(e.target.value)}
              />
              {shooterDriveId && (
                <div className="mt-1.5">
                  <label className="mb-1 block text-xs text-text-tertiary">Condition at checkout</label>
                  <Select options={conditionOptions} value={shooterCondition} onChange={(e) => setShooterCondition(e.target.value)} />
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">
                <span className="mr-1.5 inline-block rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-700">Media Mgr</span>
                Drive (goes to media management)
              </label>
              <Select
                options={driveOptions(shooterDriveId)}
                value={mmDriveId}
                onChange={(e) => setMmDriveId(e.target.value)}
              />
              {mmDriveId && (
                <div className="mt-1.5">
                  <label className="mb-1 block text-xs text-text-tertiary">Condition at checkout</label>
                  <Select options={conditionOptions} value={mmCondition} onChange={(e) => setMmCondition(e.target.value)} />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between gap-3 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button
              variant="primary"
              onClick={() => setStep(3)}
              disabled={!shooterDriveId || !mmDriveId || shooterDriveId === mmDriveId}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 — Confirm */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface-secondary p-4 space-y-3">
            {selectedCampaign && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Campaign</p>
                <p className="mt-0.5 text-sm font-medium text-text-primary">
                  {selectedCampaign.wfNumber} — {selectedCampaign.name}
                </p>
              </div>
            )}
            {shootDate && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Shoot Date</p>
                <p className="mt-0.5 text-sm text-text-primary">{shootDate}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-blue-600" />
                  <span className="text-[10px] font-semibold uppercase text-blue-600">Shooter Drive</span>
                </div>
                <p className="text-sm font-medium text-text-primary">{shooterDrive?.brand} {shooterDrive?.model}</p>
                <p className="text-xs text-text-secondary">{shooterDrive?.storageSize} · {shooterCondition}</p>
              </div>
              <div className="rounded-md border border-violet-200 bg-violet-50 p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-violet-600" />
                  <span className="text-[10px] font-semibold uppercase text-violet-600">Media Mgr Drive</span>
                </div>
                <p className="text-sm font-medium text-text-primary">{mmDrive?.brand} {mmDrive?.model}</p>
                <p className="text-xs text-text-secondary">{mmDrive?.storageSize} · {mmCondition}</p>
              </div>
            </div>
          </div>
          <div className="flex justify-between gap-3 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "Checking out…" : "Confirm Checkout"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
