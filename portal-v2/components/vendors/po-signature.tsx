"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

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
            signedIp: "captured-server-side",
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
    <form onSubmit={handleSign} className="space-y-5">
      <div>
        <p className="text-sm text-text-secondary mb-4">
          By signing below, you agree to the terms of this Purchase Order.
          Your signature, IP address, and timestamp will be recorded.
        </p>
      </div>

      {/* Signature canvas */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1.5">
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
          Clear signature
        </button>
      </div>

      {/* Printed name */}
      <Input
        label="Printed Name"
        placeholder="Your full legal name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      {/* Actions */}
      <div className="flex justify-end gap-3">
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
