"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, X, Upload, CheckCircle2, Clock, PenLine, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface SendPoModalProps {
  open: boolean;
  onClose: () => void;
  campaignVendorId: string;
  campaignId: string;
  wfNumber: string;
  vendorName: string;
  status: string;
  poFileUrl: string | null;
  poNumber: string | null;
  poSignedAt: string | null;
  signatureName: string | null;
  onSuccess: () => void;
}

function resolveUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("/") && typeof window !== "undefined") {
    return `${window.location.origin}${url}`;
  }
  return url;
}

export function SendPoModal({
  open,
  onClose,
  campaignVendorId,
  campaignId,
  wfNumber,
  vendorName,
  status,
  poFileUrl,
  poNumber,
  poSignedAt,
  signatureName,
  onSuccess,
}: SendPoModalProps) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSigned = !!poSignedAt;
  const hasPo = !!poFileUrl;
  // "Not yet sent" = estimate approved, no PO uploaded yet
  const canSend = status === "Estimate Approved" && !hasPo;
  // "Awaiting" = PO uploaded but not signed
  const isAwaiting = hasPo && !isSigned;

  // The preview always loads the rendered PO page (works from existing estimate data)
  const previewUrl = resolveUrl(`/po/${campaignVendorId}`);

  // Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Reset upload panel when modal opens/closes
  useEffect(() => {
    setShowUpload(false);
  }, [open]);

  async function handleSendForSignature() {
    setSending(true);
    try {
      const newPoNumber = `PO-${wfNumber}`;
      const newPoFileUrl = `/po/${campaignVendorId}`;

      const res = await fetch(`/api/campaign-vendors/${campaignVendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transition",
          targetStatus: "PO Uploaded",
          payload: { poFileUrl: newPoFileUrl, poNumber: newPoNumber },
        }),
      });
      if (!res.ok) throw new Error("Failed to send PO");
      toast("success", `PO sent to ${vendorName} for signature`);
      onSuccess();
      onClose();
    } catch {
      toast("error", "Failed to send PO");
    } finally {
      setSending(false);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("campaignId", campaignId);
      formData.append("category", "Contract");

      const uploadRes = await fetch("/api/files", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const uploadData = (await uploadRes.json()) as { fileUrl?: string; url?: string };
      const poFileUrl = uploadData.fileUrl || uploadData.url;
      if (!poFileUrl) throw new Error("Upload response missing file URL");

      const targetStatus = status === "Estimate Approved" ? "PO Uploaded" : status;
      const res = await fetch(`/api/campaign-vendors/${campaignVendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transition",
          targetStatus,
          payload: { poFileUrl },
        }),
      });
      if (!res.ok) throw new Error("Status update failed");
      toast("success", `PO uploaded — sent to ${vendorName} for signature`);
      onSuccess();
      onClose();
    } catch {
      toast("error", "Failed to upload PO");
    } finally {
      setUploading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  if (!open) return null;

  const signedDate = poSignedAt
    ? new Date(poSignedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  const displayPoNumber = poNumber || `PO-${wfNumber}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg flex flex-col bg-surface border border-border rounded-xl shadow-xl mt-8 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <PenLine className="h-4 w-4 text-text-tertiary shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">Purchase Order</p>
              <p className="text-xs text-text-tertiary truncate">{vendorName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors p-1 rounded-md hover:bg-surface-secondary shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {/* Status banner (awaiting or signed only) */}
          {isSigned ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-medium text-emerald-700">
                  Signed{signatureName ? ` by ${signatureName}` : ""}
                </p>
                {signedDate && <p className="text-[10px] text-emerald-600">{signedDate}</p>}
              </div>
            </div>
          ) : isAwaiting ? (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5">
              <Clock className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-xs font-medium text-amber-700">
                  {displayPoNumber} — awaiting vendor signature
                </p>
                <p className="text-[10px] text-amber-600">
                  The vendor will see a &quot;Sign PO&quot; prompt when they log in
                </p>
              </div>
            </div>
          ) : null}

          {/* PO document preview */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-surface-secondary border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-text-tertiary" />
                <span className="text-xs font-medium text-text-primary">{displayPoNumber}</span>
                {canSend && (
                  <span className="text-[10px] text-text-tertiary italic">— draft preview</span>
                )}
              </div>
              <a
                href={previewUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-text-tertiary hover:text-primary transition-colors"
              >
                Open in new tab ↗
              </a>
            </div>
            <iframe
              src={previewUrl || ""}
              title="Purchase Order Preview"
              className="w-full border-0"
              style={{ height: "340px" }}
            />
          </div>

          {/* Upload custom PO option */}
          {canSend && (
            <div>
              <button
                type="button"
                onClick={() => setShowUpload(!showUpload)}
                className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary transition-colors"
              >
                {showUpload ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Upload a custom PO document instead
              </button>

              {showUpload && (
                <div className="mt-2">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-5 cursor-pointer transition-colors ${
                      dragOver
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/60 hover:bg-surface-secondary"
                    } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {uploading ? (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    ) : (
                      <Upload className="h-5 w-5 text-text-tertiary" />
                    )}
                    <p className="text-xs text-text-secondary text-center">
                      {uploading ? "Uploading and sending…" : "Drop your PO document here or click to browse"}
                    </p>
                    <p className="text-[10px] text-text-tertiary">PDF, DOC, DOCX — sends immediately for signature</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={handleFileSelect}
                      disabled={uploading}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Replace PO option if already uploaded but not signed */}
          {isAwaiting && (
            <div>
              <button
                type="button"
                onClick={() => setShowUpload(!showUpload)}
                className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary transition-colors"
              >
                {showUpload ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Replace with a different document
              </button>

              {showUpload && (
                <div className="mt-2">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-5 cursor-pointer transition-colors ${
                      dragOver
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/60 hover:bg-surface-secondary"
                    } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {uploading ? (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    ) : (
                      <Upload className="h-5 w-5 text-text-tertiary" />
                    )}
                    <p className="text-xs text-text-secondary text-center">
                      {uploading ? "Uploading…" : "Drop replacement document or click to browse"}
                    </p>
                    <p className="text-[10px] text-text-tertiary">PDF, DOC, DOCX</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={handleFileSelect}
                      disabled={uploading}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {canSend ? "Cancel" : "Close"}
          </Button>
          {canSend && (
            <Button
              size="sm"
              loading={sending}
              onClick={handleSendForSignature}
            >
              Send for Signature
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
