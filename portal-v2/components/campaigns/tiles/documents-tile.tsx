"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { FileSection } from "@/components/campaigns/file-section";
import { FileText } from "lucide-react";

interface Props {
  campaignId: string;
  isVendor: boolean;
  canEdit: boolean;
  uploading: boolean;
  onUpload: (file: File, category: string) => Promise<void>;
  hideAdminDocs?: boolean;
}

export function DocumentsTile({ campaignId, isVendor, canEdit, uploading, onUpload, hideAdminDocs }: Props) {
  const showAdminSection = !isVendor && !hideAdminDocs;
  return (
    <Card padding="none" className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <FileText className="h-4 w-4 shrink-0 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">Documents</h3>
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 py-3">
        {isVendor && (
          <div className="mb-3 rounded-lg border border-border bg-surface-secondary px-3 py-2.5">
            <p className="text-xs text-text-secondary">
              Campaign documents are read-only for vendors. Use{" "}
              <Link href="/vendor-workflow" className="font-medium text-primary hover:underline">
                Workflow
              </Link>{" "}
              to submit estimates, sign POs, and upload invoices.
            </p>
          </div>
        )}
        <div className={showAdminSection ? "grid grid-cols-1 md:grid-cols-2 gap-6" : ""}>
          <FileSection
            title={isVendor ? "Campaign Documents" : "Creative"}
            campaignId={campaignId}
            type="fun"
            categories={isVendor ? ["Deliverable"] : ["Shot List", "Concept Deck", "Reference", "Product Info"]}
            onUpload={onUpload}
            uploading={uploading}
            canUpload={!isVendor && (canEdit || !!hideAdminDocs)}
          />
          {showAdminSection && (
            <FileSection
              title="Admin"
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
    </Card>
  );
}
