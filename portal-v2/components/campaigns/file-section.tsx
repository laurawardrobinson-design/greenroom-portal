"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import { FileText, Upload, X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

interface Asset {
  id: string;
  fileName: string;
  fileUrl: string;
  category: string;
}

function isPdf(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf");
}

function isImage(fileName: string) {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName);
}

function FilePreviewModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pdf = isPdf(asset.fileName);
  const image = isImage(asset.fileName);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // For PDFs, detect total pages via pdf.js message or just rely on browser viewer
  // We'll use an iframe with #page= param for basic page nav
  const iframeSrc = pdf
    ? `${asset.fileUrl}#page=${currentPage}&toolbar=1&navpanes=0`
    : asset.fileUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: "min(900px, 94vw)", height: "min(860px, 92vh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border bg-surface shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="h-4 w-4 text-text-tertiary shrink-0" />
            <span className="text-sm font-semibold text-text-primary truncate">{asset.fileName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={asset.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors px-2 py-1 rounded-lg hover:bg-surface-secondary"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </a>
            <button
              onClick={onClose}
              className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-surface-secondary transition-colors text-text-secondary hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-surface-secondary">
          {image ? (
            <div className="flex items-center justify-center h-full overflow-auto p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.fileUrl}
                alt={asset.fileName}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          ) : (
            <iframe
              key={iframeSrc}
              src={iframeSrc}
              className="w-full h-full border-none"
              title={asset.fileName}
            />
          )}
        </div>

        {/* PDF page controls — only shown for PDFs */}
        {pdf && (
          <div className="flex items-center justify-center gap-3 px-5 py-2.5 border-t border-border bg-surface shrink-0">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center justify-center h-7 w-7 rounded-lg border border-border hover:bg-surface-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-text-secondary tabular-nums">
              Page {currentPage}
            </span>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              className="flex items-center justify-center h-7 w-7 rounded-lg border border-border hover:bg-surface-secondary transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function FileSection({
  title,
  campaignId,
  type,
  categories,
  onUpload,
  uploading,
  canUpload,
}: {
  title: string;
  campaignId: string;
  type: "fun" | "boring";
  categories: string[];
  onUpload: (file: File, category: string) => Promise<void>;
  uploading: boolean;
  canUpload: boolean;
}) {
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const swrKey = `/api/files?campaignId=${campaignId}&type=${type}`;
  const { data: assets = [], mutate } = useSWR(
    swrKey,
    (url: string) => fetch(url).then((r) => r.json())
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) { await onUpload(file, categories[0]); mutate(); }
    },
    [onUpload, categories, mutate]
  );

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wider text-text-tertiary mb-3">{title}</p>
      {canUpload && (
        <label
          className="block"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
          onDrop={handleDrop}
        >
          <div
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 cursor-pointer transition-colors ${
              isDragOver
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-surface-secondary text-text-secondary hover:bg-surface-tertiary hover:border-text-tertiary"
            }`}
          >
            <Upload className={`h-5 w-5 ${isDragOver ? "text-primary" : "text-text-tertiary"}`} />
            <span className="text-sm font-medium">
              {uploading ? "Uploading..." : isDragOver ? "Drop to upload" : "Drop files or click to browse"}
            </span>
          </div>
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) { await onUpload(file, categories[0]); mutate(); }
              e.target.value = "";
            }}
          />
        </label>
      )}
      {assets.length > 0 && (
        <div className="space-y-1.5 mt-3">
          {assets.map((asset: Asset) => (
            <button
              key={asset.id}
              onClick={() => setPreviewAsset(asset)}
              className="w-full flex items-center gap-3 rounded-lg bg-surface-secondary p-2.5 hover:bg-surface-tertiary transition-colors text-left"
            >
              <FileText className="h-4 w-4 text-primary/60 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary/70 truncate">{asset.fileName}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {previewAsset && (
        <FilePreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />
      )}
    </div>
  );
}
