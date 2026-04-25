"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { FileSection } from "@/components/campaigns/file-section";

interface Props {
  campaignId: string;
  isVendor: boolean;
  canEdit: boolean;
  uploading: boolean;
  onUpload: (file: File, category: string) => Promise<void>;
  hideAdminDocs?: boolean;
}

export function DocumentsTabTile({ campaignId, isVendor, canEdit, uploading, onUpload, hideAdminDocs }: Props) {
  const showAdmin = !isVendor && !hideAdminDocs;
  const [tab, setTab] = useState<"creative" | "admin">("creative");

  return (
    <div className="flex h-full min-h-0 flex-col border border-border rounded-lg bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border shrink-0">
        <FileText className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">Documents</span>
      </div>

      {/* Tab bar — only shown when admin docs are visible */}
      {showAdmin && (
        <div className="flex shrink-0 border-b border-border px-3.5">
          {(["creative", "admin"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-1 py-2 mr-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-text-tertiary hover:text-text-primary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
        {tab === "creative" && (
          <FileSection
            title=""
            campaignId={campaignId}
            type="fun"
            categories={["Shot List", "Concept Deck", "Reference", "Product Info"]}
            onUpload={onUpload}
            uploading={uploading}
            canUpload={!isVendor && (canEdit || !!hideAdminDocs)}
          />
        )}
        {tab === "admin" && showAdmin && (
          <FileSection
            title=""
            campaignId={campaignId}
            type="boring"
            categories={["Contract", "Estimate", "PO", "Invoice", "Insurance", "Legal"]}
            onUpload={onUpload}
            uploading={uploading}
            canUpload={canEdit}
          />
        )}
      </div>
    </div>
  );
}
