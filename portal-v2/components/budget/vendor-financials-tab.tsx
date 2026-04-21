"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils/format";
import { Receipt, Loader2, FileText, FilePlus, PenLine } from "lucide-react";
import Link from "next/link";
import { LineItemComparisonPanel } from "@/components/budget/line-item-comparison-panel";
import { PdfPreviewModal } from "@/components/budget/pdf-preview-modal";
import { SendPoModal } from "@/components/budget/send-po-modal";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

interface VendorFinancialItem {
  id: string;
  campaignId: string;
  campaignName: string;
  wfNumber: string;
  vendorName: string;
  status: string;
  estimateTotal: number;
  invoiceTotal: number | null;
  updatedAt: string;
  estimateFileUrl: string | null;
  estimateFileName: string | null;
  poFileUrl: string | null;
  poNumber: string | null;
  poSignedFileUrl: string | null;
  poSignedAt: string | null;
  signatureName: string | null;
  invoiceFileUrl: string | null;
  invoiceFileName: string | null;
}

interface CampaignFilterOption {
  id: string;
  name: string;
  wfNumber: string;
}

interface CampaignGroup {
  campaignId: string;
  campaignName: string;
  wfNumber: string;
  vendors: VendorFinancialItem[];
}

const STATUS_LABEL: Record<string, string> = {
  "Estimate Submitted": "Pending Estimate",
  "Estimate Approved": "Estimate Approved",
  "PO Uploaded": "PO Sent",
  "PO Signed": "PO Signed",
  "Shoot Complete": "Shoot Complete",
  "Invoice Submitted": "Invoice Pending",
  "Invoice Pre-Approved": "Pre-Approved",
  "Invoice Approved": "Invoice Approved",
  "Paid": "Paid",
};

const STATUS_COLOR: Record<string, string> = {
  "Estimate Submitted": "bg-amber-50 text-amber-700",
  "Estimate Approved": "bg-blue-50 text-blue-700",
  "PO Uploaded": "bg-blue-50 text-blue-700",
  "PO Signed": "bg-blue-50 text-blue-700",
  "Shoot Complete": "bg-purple-50 text-purple-700",
  "Invoice Submitted": "bg-amber-50 text-amber-700",
  "Invoice Pre-Approved": "bg-amber-50 text-amber-700",
  "Invoice Approved": "bg-emerald-50 text-emerald-700",
  "Paid": "bg-emerald-50 text-emerald-700",
};

// Status ordering for "at or past" checks
const STATUS_ORDER = [
  "Invited", "Estimate Submitted", "Estimate Approved",
  "PO Uploaded", "PO Signed", "Shoot Complete",
  "Invoice Submitted", "Invoice Pre-Approved", "Invoice Approved", "Paid",
];
function isAtOrPast(current: string, target: string): boolean {
  return STATUS_ORDER.indexOf(current) >= STATUS_ORDER.indexOf(target);
}

type DocColor = "dim" | "default" | "amber" | "green";

const DOC_COLOR_CLASSES: Record<DocColor, string> = {
  dim: "text-text-tertiary/20",
  default: "text-text-tertiary hover:text-primary",
  amber: "text-amber-500 hover:text-amber-600",
  green: "text-emerald-500 hover:text-emerald-600",
};

// Estimate process progress bar shown per vendor
const PROGRESS_STAGES = [
  { label: "Estimate", reachedAt: "Estimate Submitted" },
  { label: "Approved", reachedAt: "Estimate Approved" },
  { label: "PO", reachedAt: "PO Signed" },
  { label: "Invoiced", reachedAt: "Invoice Submitted" },
  { label: "Paid", reachedAt: "Paid" },
];

function VendorProgressBar({ status }: { status: string }) {
  const currentIdx = STATUS_ORDER.indexOf(status);
  return (
    <div className="flex items-center gap-0 px-1 pb-1.5 pt-0.5">
      {PROGRESS_STAGES.map((stage, i) => {
        const stageIdx = STATUS_ORDER.indexOf(stage.reachedAt);
        const reached = currentIdx >= stageIdx;
        const isLast = i === PROGRESS_STAGES.length - 1;
        return (
          <div key={stage.label} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <div className={`h-2 w-2 rounded-full transition-colors ${reached ? "bg-primary" : "bg-surface-tertiary border border-border"}`} />
              <span className={`text-[10px] leading-tight ${reached ? "text-primary font-medium" : "text-text-tertiary"}`}>
                {stage.label}
              </span>
            </div>
            {!isLast && (
              <div className={`flex-1 h-px mx-0.5 transition-colors ${
                currentIdx >= STATUS_ORDER.indexOf(PROGRESS_STAGES[i + 1].reachedAt)
                  ? "bg-primary"
                  : reached
                  ? "bg-primary/40"
                  : "bg-surface-tertiary"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Regular doc icon (for estimate PDF, PO signed, invoice PDF)
function DocIcon({
  url,
  fileName,
  title,
  color,
  onOpen,
}: {
  url: string | null;
  fileName: string | null;
  title: string;
  color: DocColor;
  onOpen?: (url: string, fileName: string) => void;
}) {
  const cls = DOC_COLOR_CLASSES[color];
  if (!url || !onOpen) {
    return (
      <span className={`flex items-center justify-center ${cls}`}>
        <FileText className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <button
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(url, fileName || "Document");
      }}
      className={`flex items-center justify-center transition-colors ${cls}`}
    >
      <FileText className="h-3.5 w-3.5" />
    </button>
  );
}

// PO action icon — shows FilePlus when action needed, FileText+PenLine when uploaded
function PoActionIcon({
  status,
  poFileUrl,
  poSignedAt,
  onClick,
}: {
  status: string;
  poFileUrl: string | null;
  poSignedAt: string | null;
  onClick: () => void;
}) {
  const isSigned = !!poSignedAt;
  const hasPo = !!poFileUrl;
  const actionNeeded = status === "Estimate Approved" && !hasPo;

  // Not applicable before "Estimate Approved"
  if (!isAtOrPast(status, "Estimate Approved")) {
    return (
      <span className="flex items-center justify-center text-text-tertiary/20">
        <FileText className="h-3.5 w-3.5" />
      </span>
    );
  }

  // Signed — green check
  if (isSigned) {
    return (
      <button
        title="PO signed — click to manage"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="flex items-center justify-center text-emerald-500 hover:text-emerald-600 transition-colors"
      >
        <FileText className="h-3.5 w-3.5" />
      </button>
    );
  }

  // Action needed — upload PO
  if (actionNeeded) {
    return (
      <button
        title="Upload PO and send for signature"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="flex items-center justify-center text-amber-500 hover:text-amber-600 transition-colors"
      >
        <FilePlus className="h-3.5 w-3.5" />
      </button>
    );
  }

  // PO uploaded, waiting for signature
  if (hasPo) {
    return (
      <button
        title="PO sent — awaiting signature"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="flex items-center justify-center text-amber-500 hover:text-amber-600 transition-colors"
      >
        <FileText className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <span className="flex items-center justify-center text-text-tertiary/20">
      <FileText className="h-3.5 w-3.5" />
    </span>
  );
}

// PO signed column icon
function PoSignedIcon({
  status,
  poSignedFileUrl,
  poSignedAt,
  onOpen,
}: {
  status: string;
  poSignedFileUrl: string | null;
  poSignedAt: string | null;
  onOpen: (url: string, fileName: string) => void;
}) {
  const isSigned = !!poSignedAt;

  if (!isSigned) {
    return (
      <span className="flex items-center justify-center text-text-tertiary/20">
        <PenLine className="h-3.5 w-3.5" />
      </span>
    );
  }

  // Signed and has a signed PDF
  if (poSignedFileUrl) {
    return (
      <button
        title="View signed PO"
        onClick={(e) => { e.stopPropagation(); onOpen(poSignedFileUrl, "Signed PO"); }}
        className="flex items-center justify-center text-emerald-500 hover:text-emerald-600 transition-colors"
      >
        <PenLine className="h-3.5 w-3.5" />
      </button>
    );
  }

  // Signed but no PDF (electronic signature captured, no combined PDF)
  return (
    <span
      title="PO signed electronically"
      className="flex items-center justify-center text-emerald-500 cursor-default"
    >
      <PenLine className="h-3.5 w-3.5" />
    </span>
  );
}

export function VendorFinancialsTab() {
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pdfModal, setPdfModal] = useState<{ url: string; fileName: string } | null>(null);
  const [poModal, setPoModal] = useState<VendorFinancialItem | null>(null);

  const { data, mutate } = useSWR<{
    items: VendorFinancialItem[];
    campaigns: CampaignFilterOption[];
  }>("/api/estimates/summary", fetcher);

  const items = data?.items || [];
  const campaignOptions = data?.campaigns || [];

  const filtered = campaignFilter === "all"
    ? items
    : items.filter((i) => i.campaignId === campaignFilter);

  const groups = useMemo<CampaignGroup[]>(() => {
    const map = new Map<string, CampaignGroup>();
    for (const item of filtered) {
      if (!map.has(item.campaignId)) {
        map.set(item.campaignId, {
          campaignId: item.campaignId,
          campaignName: item.campaignName,
          wfNumber: item.wfNumber,
          vendors: [],
        });
      }
      map.get(item.campaignId)!.vendors.push(item);
    }
    return Array.from(map.values());
  }, [filtered]);

  function openPdf(url: string, fileName: string) {
    setPdfModal({ url, fileName });
  }

  function toggleRow(id: string) {
    setOpenId(openId === id ? null : id);
  }

  // Derive estimate PDF icon color from status
  function estimatePdfColor(v: VendorFinancialItem): DocColor {
    if (!v.estimateFileUrl) return "dim";
    if (isAtOrPast(v.status, "Estimate Approved")) return "green";
    return "amber"; // Estimate Submitted — pending review
  }

  // Derive invoice PDF icon color from status
  function invoicePdfColor(v: VendorFinancialItem): DocColor {
    if (!v.invoiceFileUrl) return "dim";
    if (isAtOrPast(v.status, "Invoice Approved")) return "green";
    if (isAtOrPast(v.status, "Invoice Submitted")) return "amber";
    return "default";
  }

  return (
    <>
      <Card padding="none" className="max-w-2xl">
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
          <Receipt className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">Vendor Financials</span>
          <select
            value={campaignFilter}
            onChange={(e) => {
              setCampaignFilter(e.target.value);
              setOpenId(null);
            }}
            className="ml-auto text-xs bg-surface-secondary border border-border rounded-md px-2 py-1.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All campaigns</option>
            {campaignOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.wfNumber} — {c.name}
              </option>
            ))}
          </select>
        </div>

        {!data ? (
          <div className="flex items-center justify-center py-10 text-text-tertiary">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            title="No vendor financials"
            description="Vendor estimates will appear here once submitted."
          />
        ) : (
          <>
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_130px_64px_20px_20px_20px_64px_20px] gap-x-2 px-4 py-1.5 border-b border-border">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Vendor</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary text-center">Status</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary text-right">Estimate</span>
              <span />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary text-center">PO</span>
              <span />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary text-right">Invoice</span>
              <span />
            </div>

            <div className="divide-y divide-border">
              {groups.map((group) => (
                <div key={group.campaignId} className="px-4 py-3">
                  <div className="flex items-baseline gap-2 mb-2">
                    <Link
                      href={`/campaigns/${group.campaignId}`}
                      className="text-sm font-semibold text-text-primary hover:text-primary transition-colors"
                    >
                      {group.campaignName}
                    </Link>
                    <span className="text-xs text-text-tertiary">{group.wfNumber}</span>
                  </div>

                  <div className="space-y-0.5">
                    {group.vendors.map((v) => {
                      const isOpen = openId === v.id;
                      const hasInvoice = v.invoiceTotal != null && v.invoiceTotal > 0;
                      const isOver = hasInvoice && v.invoiceTotal! > v.estimateTotal;
                      const hasEstimate = v.estimateTotal > 0;

                      return (
                        <div key={v.id}>
                          <div className="grid grid-cols-[1fr_130px_64px_20px_20px_20px_64px_20px] items-center gap-x-2 py-1.5 px-1 -mx-1 rounded-md">
                            {/* Vendor name */}
                            <span className="text-xs font-medium text-text-primary truncate">
                              {v.vendorName}
                            </span>

                            {/* Status badge */}
                            <Badge
                              variant="custom"
                              className={`text-[10px] justify-center ${STATUS_COLOR[v.status] || "bg-surface-secondary text-text-secondary"}`}
                            >
                              {STATUS_LABEL[v.status] || v.status}
                            </Badge>

                            {/* Estimate $ */}
                            {hasEstimate ? (
                              <button
                                className={`text-xs text-right font-medium w-full transition-colors ${isOpen ? "text-primary" : "text-text-primary hover:text-primary"}`}
                                onClick={() => toggleRow(v.id)}
                              >
                                {formatCurrency(v.estimateTotal)}
                              </button>
                            ) : (
                              <span className="text-xs text-right text-text-tertiary">—</span>
                            )}

                            {/* Estimate PDF icon */}
                            <DocIcon
                              url={v.estimateFileUrl}
                              fileName={v.estimateFileName}
                              title="View estimate PDF"
                              color={estimatePdfColor(v)}
                              onOpen={openPdf}
                            />

                            {/* PO action icon */}
                            <PoActionIcon
                              status={v.status}
                              poFileUrl={v.poFileUrl}
                              poSignedAt={v.poSignedAt}
                              onClick={() => setPoModal(v)}
                            />

                            {/* PO signed icon */}
                            <PoSignedIcon
                              status={v.status}
                              poSignedFileUrl={v.poSignedFileUrl}
                              poSignedAt={v.poSignedAt}
                              onOpen={openPdf}
                            />

                            {/* Invoice $ */}
                            {hasInvoice ? (
                              <button
                                className={`text-xs text-right font-medium w-full transition-colors ${isOpen ? "text-primary" : isOver ? "text-red-600 hover:text-red-500" : "text-text-primary hover:text-primary"}`}
                                onClick={() => toggleRow(v.id)}
                              >
                                {formatCurrency(v.invoiceTotal!)}
                              </button>
                            ) : (
                              <span className="text-xs text-right text-text-tertiary">—</span>
                            )}

                            {/* Invoice PDF icon */}
                            <DocIcon
                              url={v.invoiceFileUrl}
                              fileName={v.invoiceFileName}
                              title="View invoice PDF"
                              color={invoicePdfColor(v)}
                              onOpen={openPdf}
                            />
                          </div>

                          {/* Status progress track */}
                          <VendorProgressBar status={v.status} />

                          {/* Line item comparison panel */}
                          {isOpen && (
                            <div className="ml-1 mb-2 border-t border-border">
                              <LineItemComparisonPanel
                                campaignVendorId={v.id}
                                status={v.status}
                                onStatusChange={() => {
                                  setOpenId(null);
                                  mutate();
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* PDF preview modal */}
      <PdfPreviewModal
        open={pdfModal !== null}
        onClose={() => setPdfModal(null)}
        url={pdfModal?.url ?? null}
        fileName={pdfModal?.fileName ?? null}
        onRefresh={mutate}
      />

      {/* PO upload + send for signature modal */}
      {poModal && (
        <SendPoModal
          open={true}
          onClose={() => setPoModal(null)}
          campaignVendorId={poModal.id}
          campaignId={poModal.campaignId}
          wfNumber={poModal.wfNumber}
          vendorName={poModal.vendorName}
          status={poModal.status}
          poFileUrl={poModal.poFileUrl}
          poNumber={poModal.poNumber}
          poSignedAt={poModal.poSignedAt}
          signatureName={poModal.signatureName}
          onSuccess={() => {
            setPoModal(null);
            mutate();
          }}
        />
      )}
    </>
  );
}
