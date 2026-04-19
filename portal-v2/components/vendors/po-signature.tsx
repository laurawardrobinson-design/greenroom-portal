"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ShieldCheck } from "lucide-react";

interface Props {
  campaignVendorId: string;
  poFileUrl?: string | null;
  onSigned: () => void;
  onCancel: () => void;
}

export function PoSignature({
  campaignVendorId,
  onSigned,
  onCancel,
}: Props) {
  const { toast } = useToast();
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [name, setName] = useState("");
  const [signing, setSigning] = useState(false);
  const signedAt = new Date();

  function clearSignature() {
    sigRef.current?.clear();
  }

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();

    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast("error", "Please draw your signature");
      return;
    }
    if (!name.trim()) {
      toast("error", "Please enter your printed name");
      return;
    }

    setSigning(true);
    try {
      const signatureDataUrl = sigRef.current.toDataURL("image/png");

      const res = await fetch(`/api/campaign-vendors/${campaignVendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transition",
          targetStatus: "PO Signed",
          payload: {
            signatureUrl: signatureDataUrl,
            signatureName: name.trim(),
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to sign PO");
      }

      toast("success", "PO signed successfully");
      onSigned();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to sign");
    } finally {
      setSigning(false);
    }
  }

  return (
    <form onSubmit={handleSign} autoComplete="off" className="space-y-4">
      {/* Signature canvas */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">
          Signature
        </label>
        <div className="rounded-lg border-2 border-dashed border-border bg-white overflow-hidden">
          <SignatureCanvas
            ref={sigRef}
            canvasProps={{
              className: "w-full h-32",
              style: { width: "100%", height: "128px" },
            }}
            penColor="#1F1F1F"
            backgroundColor="white"
          />
        </div>
        <button
          type="button"
          onClick={clearSignature}
          className="mt-1.5 text-xs text-text-tertiary hover:text-text-primary transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Printed name — autocomplete disabled to avoid browser autofill popup */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">
          Printed Name
        </label>
        <input
          type="text"
          autoComplete="off"
          data-form-type="other"
          placeholder="Your full legal name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
        />
      </div>

      {/* Timestamp + IP notice */}
      <div className="flex items-start gap-2 rounded-lg bg-surface-secondary border border-border px-3 py-2">
        <ShieldCheck className="h-3.5 w-3.5 text-text-tertiary shrink-0 mt-0.5" />
        <div className="text-[10px] text-text-tertiary space-y-0.5">
          <p><span className="font-medium text-text-secondary">Timestamp:</span> {format(signedAt, "MMM d, yyyy 'at' h:mm a")}</p>
          <p><span className="font-medium text-text-secondary">IP address:</span> Captured server-side upon submission</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={signing}>
          Sign Purchase Order
        </Button>
      </div>
    </form>
  );
}
