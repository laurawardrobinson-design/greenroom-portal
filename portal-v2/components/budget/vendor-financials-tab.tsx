"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils/format";
import { Loader2, FileText, FilePlus, PenLine, Building2 } from "lucide-react";
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
  "Estimate Submitted": "bg-amber-50 text-warning",
  "Estimate Approved": "bg-blue-50 text-blue-700",
  "PO Uploaded": "bg-blue-50 text-blue-700",
  "PO Signed": "bg-blue-50 text-blue-700",
  "Shoot Complete": "bg-purple-50 text-purple-700",
  "Invoice Submitted": "bg-amber-50 text-warning",
  "Invoice Pre-Approved": "bg-amber-50 text-warning",
  "Invoice Approved": "bg-emerald-50 text-success",
  "Paid": "bg-emerald-50 text-success",
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
  amber: "text-amber-500 hover:text-warning",
  green: "text-emerald-500 hover:text-success",
};

// Vendor lifecycle stages shown as a labeled 7-step progress bar, one segment
// per stage with the label underneath. Matches the approved mockup.
const LIFECYCLE_STAGES: Array<{ label: string; reachedAt: string }> = [
  { label: "Invited", reachedAt: "Invited" },
  { label: "Estimate", reachedAt: "Estimate Submitted" },
  { label: "Approved", reachedAt: "Estimate Approved" },
  { label: "PO Sent", reachedAt: "PO Uploaded" },
  { label: "PO Signed", reachedAt: "PO Signed" },
  { label: "Invoice", reachedAt: "Invoice Submitted" },
  { label: "Paid", reachedAt: "Paid" },
];

function LifecycleProgress({ status }: { status: string }) {
  const currentIdx = STATUS_ORDER.indexOf(status);
  // The "current" stage is the last one whose reachedAt has been hit but whose
  // next stage has not — that's the ring highlight.
  let currentStageIdx = -1;
  for (let i = LIFECYCLE_STAGES.length - 1; i >= 0; i--) {
    const sIdx = STATUS_ORDER.indexOf(LIFECYCLE_STAGES[i].reachedAt);
    if (currentIdx >= sIdx) { currentStageIdx = i; break; }
  }
  return (
    <div className="grid grid-cols-7 gap-1.5" aria-label={`Progress: ${status}`}>
      {LIFECYCLE_STAGES.map((stage, idx) => {
        const stageReachedIdx = STATUS_ORDER.indexOf(stage.reachedAt);
        const reached = currentIdx >= stageReachedIdx;
        const isCurrent = idx === currentStageIdx;
        return (
          <div key={stage.label} className="flex flex-col items-center gap-1 min-w-0">
            <div className={`h-1 w-full rounded-full transition-colors ${
              reached ? "bg-primary" : "bg-surface-tertiary"
            } ${isCurrent ? "ring-2 ring-primary/30" : ""}`} />
            <span className={`text-[10px] leading-tight truncate w-full text-center ${
              reached ? "text-text-secondary" : "text-text-tertiary/60"
            }`}>
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Labeled document chips shown in the expanded row ───
// Takes the place of the cramped single-icon columns — readable in the
// expanded card where space is available.

function DocActionChip({
  label,
  icon,
  color,
  url,
  fileName,
  onOpen,
}: {
  label: string;
  icon: React.ReactNode;
  color: DocColor;
  url: string | null;
  fileName: string | null;
  onOpen: (url: string, fileName: string) => void;
}) {
  const toneClass =
    color === "green" ? "text-success border-emerald-200 bg-emerald-50 hover:bg-emerald-100" :
    color === "amber" ? "text-warning border-amber-200 bg-amber-50 hover:bg-amber-100" :
    color === "dim"   ? "text-text-tertiary/50 border-border bg-surface-secondary cursor-default" :
                        "text-text-secondary border-border bg-surface-secondary hover:bg-surface";
  if (!url) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${toneClass}`}>
        {icon}
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(url, fileName || label); }}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors ${toneClass}`}
    >
      {icon}
      {label}
    </button>
  );
}

function PoActionChip({
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
  if (!isAtOrPast(status, "Estimate Approved")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-secondary px-2 py-0.5 text-text-tertiary/50">
        <FileText className="h-3.5 w-3.5" />
        PO
      </span>
    );
  }
  if (isSigned) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-success hover:bg-emerald-100 transition-colors"
      >
        <FileText className="h-3.5 w-3.5" />
        PO uploaded
      </button>
    );
  }
  if (status === "Estimate Approved" && !hasPo) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-warning hover:bg-amber-100 transition-colors"
      >
        <FilePlus className="h-3.5 w-3.5" />
        Send PO
      </button>
    );
  }
  if (hasPo) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-warning hover:bg-amber-100 transition-colors"
      >
        <FileText className="h-3.5 w-3.5" />
        PO awaiting signature
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-secondary px-2 py-0.5 text-text-tertiary/50">
      <FileText className="h-3.5 w-3.5" />
      PO
    </span>
  );
}

function PoSignedChip({
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
  void status;
  const isSigned = !!poSignedAt;
  if (!isSigned) return null;
  if (poSignedFileUrl) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpen(poSignedFileUrl, "Signed PO"); }}
        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-success hover:bg-emerald-100 transition-colors"
      >
        <PenLine className="h-3.5 w-3.5" />
        Signed PO
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-success">
      <PenLine className="h-3.5 w-3.5" />
      Signed
    </span>
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
        className="flex items-center justify-center text-emerald-500 hover:text-success transition-colors"
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
        className="flex items-center justify-center text-amber-500 hover:text-warning transition-colors"
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
        className="flex items-center justify-center text-amber-500 hover:text-warning transition-colors"
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
        className="flex items-center justify-center text-emerald-500 hover:text-success transition-colors"
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
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Campaign:</span>
        <select
          value={campaignFilter}
          onChange={(e) => {
            setCampaignFilter(e.target.value);
            setOpenId(null);
          }}
          className="text-xs bg-surface-secondary border border-border rounded-md px-2 py-1.5 text-text-primary focus:outline-none"
        >
          <option value="all">All campaigns</option>
          {campaignOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.wfNumber} — {c.name}
            </option>
          ))}
        </select>
        <span className="ml-auto text-[10px] text-text-tertiary">{groups.length} campaign{groups.length !== 1 ? "s" : ""}</span>
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
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.campaignId} padding="none">
              <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
                <Building2 className="h-4 w-4 shrink-0 text-primary" />
                <Link
                  href={`/campaigns/${group.campaignId}`}
                  className="text-sm font-semibold uppercase tracking-wider text-text-primary hover:text-primary transition-colors"
                >
                  {group.campaignName}
                </Link>
                <span className="ml-auto text-[10px] text-text-tertiary">{group.wfNumber}</span>
              </div>

              <div className="divide-y divide-border">
                {group.vendors.map((v) => {
                  const isOpen = openId === v.id;
                  const hasInvoice = v.invoiceTotal != null && v.invoiceTotal > 0;
                  const isOver = hasInvoice && v.invoiceTotal! > v.estimateTotal;
                  const hasEstimate = v.estimateTotal > 0;
                  const amountToShow = hasInvoice ? v.invoiceTotal! : hasEstimate ? v.estimateTotal : null;

                  return (
                    <div key={v.id} className="px-3.5 py-3">
                      <button
                        type="button"
                        onClick={() => toggleRow(v.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">{v.vendorName}</p>
                            <p className="text-[10px] text-text-tertiary mt-0.5">
                              {STATUS_LABEL[v.status] || v.status}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            {amountToShow !== null ? (
                              <>
                                <p className={`text-sm font-semibold ${isOver ? "text-error" : "text-text-primary"}`}>
                                  {formatCurrency(amountToShow)}
                                </p>
                                {hasInvoice && hasEstimate && (
                                  <p className="text-[10px] text-text-tertiary">
                                    est {formatCurrency(v.estimateTotal)}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-text-tertiary">—</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-2.5">
                          <LifecycleProgress status={v.status} />
                        </div>
                      </button>

                      {/* Expanded: document actions + line-item comparison */}
                      {isOpen && (
                        <div className="mt-3 pt-3 border-t border-border space-y-3">
                          <div className="flex flex-wrap items-center gap-3 text-[10px]">
                            <DocActionChip
                              label="Estimate PDF"
                              icon={<FileText className="h-3.5 w-3.5" />}
                              color={estimatePdfColor(v)}
                              url={v.estimateFileUrl}
                              fileName={v.estimateFileName}
                              onOpen={openPdf}
                            />
                            <PoActionChip
                              status={v.status}
                              poFileUrl={v.poFileUrl}
                              poSignedAt={v.poSignedAt}
                              onClick={() => setPoModal(v)}
                            />
                            <PoSignedChip
                              status={v.status}
                              poSignedFileUrl={v.poSignedFileUrl}
                              poSignedAt={v.poSignedAt}
                              onOpen={openPdf}
                            />
                            <DocActionChip
                              label="Invoice PDF"
                              icon={<FileText className="h-3.5 w-3.5" />}
                              color={invoicePdfColor(v)}
                              url={v.invoiceFileUrl}
                              fileName={v.invoiceFileName}
                              onOpen={openPdf}
                            />
                          </div>
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
            </Card>
          ))}
        </div>
      )}

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
