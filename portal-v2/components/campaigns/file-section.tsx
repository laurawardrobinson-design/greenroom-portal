"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { FileText, Upload, X } from "lucide-react";

const FilePreviewModal = dynamic(() => import("./file-preview-modal"), { ssr: false });

interface Asset {
  id: string;
  fileName: string;
  fileUrl: string;
  category: string;
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
  const [deleting, setDeleting] = useState<string | null>(null);

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

  async function handleDelete(id: string) {
    setDeleting(id);
    await fetch(`/api/files?id=${id}`, { method: "DELETE" });
    await mutate();
    setDeleting(null);
  }

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wider text-text-tertiary mb-2">{title}</p>
      {canUpload && (
        <label
          className="block"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
          onDrop={handleDrop}
        >
          <div
            className={`flex items-center justify-center gap-2 rounded-lg border border-dashed py-3 cursor-pointer transition-colors ${
              isDragOver
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-surface-secondary text-text-secondary hover:bg-surface-tertiary hover:border-text-tertiary"
            }`}
          >
            <Upload className={`h-3.5 w-3.5 ${isDragOver ? "text-primary" : "text-text-tertiary"}`} />
            <span className="text-sm">
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
        <div className="space-y-1 mt-2 max-h-[130px] overflow-y-auto">
          {assets.map((asset: Asset) => (
            <div
              key={asset.id}
              className="group flex items-center gap-2 rounded-md bg-surface-secondary px-2 py-1.5 hover:bg-surface-tertiary transition-colors"
            >
              <button
                onClick={() => setPreviewAsset(asset)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <FileText className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                <p className="text-sm text-primary/70 truncate">{asset.fileName}</p>
              </button>
              {canUpload && (
                <button
                  onClick={() => handleDelete(asset.id)}
                  disabled={deleting === asset.id}
                  className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-surface-secondary transition-opacity text-text-tertiary hover:text-text-primary disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {previewAsset && (
        <FilePreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />
      )}
    </div>
  );
}
