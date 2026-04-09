"use client";

import { useEffect, useState } from "react";
import { FileText, X, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PdfPreviewModalProps {
  open: boolean;
  onClose: () => void;
  url: string | null;
  fileName: string | null;
  onRefresh?: () => void;
}

export function PdfPreviewModal({ open, onClose, url, fileName, onRefresh }: PdfPreviewModalProps) {
  const [loadError, setLoadError] = useState(false);

  // Reset state when URL changes
  useEffect(() => {
    setLoadError(false);
  }, [url]);

  // Resolve relative paths to absolute so iframes always get a fully-qualified URL
  // (browsers can misroute relative paths in iframes to port 80 instead of the dev port)
  const resolvedUrl =
    url && url.startsWith("/") && typeof window !== "undefined"
      ? `${window.location.origin}${url}`
      : url;
  const proxiedUrl =
    resolvedUrl && typeof window !== "undefined" && !resolvedUrl.startsWith(window.location.origin)
      ? `/api/document-proxy?url=${encodeURIComponent(resolvedUrl)}`
      : resolvedUrl;

  // Escape key closes modal
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open || !url || !resolvedUrl) return null;

  const displayName = fileName || "Document";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-3xl flex flex-col bg-surface border border-border rounded-xl shadow-xl max-h-[90vh] mt-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-text-tertiary shrink-0" />
            <span className="text-sm font-medium text-text-primary truncate">{displayName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={resolvedUrl}
              download={displayName}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border rounded-md px-2.5 py-1.5 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
            <button
              onClick={onClose}
              className="text-text-tertiary hover:text-text-primary transition-colors p-1 rounded-md hover:bg-surface-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="relative flex-1 overflow-hidden rounded-b-xl min-h-[70vh]">
          {loadError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface text-center px-6">
              <p className="text-sm text-text-secondary">
                The document link has expired or could not be loaded.
              </p>
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-primary hover:underline"
              >
                Open in new tab
              </a>
              {onRefresh && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setLoadError(false);
                    onRefresh();
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
              )}
            </div>
          ) : (
            <iframe
              src={proxiedUrl || resolvedUrl}
              title={displayName}
              className="w-full h-full border-0 rounded-b-xl"
              style={{ minHeight: "70vh" }}
              onError={() => setLoadError(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
