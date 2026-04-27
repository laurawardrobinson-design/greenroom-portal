"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import useSWR from "swr";
import type { CampaignVendor, CampaignVendorStatus, VendorEstimateItem, VendorInvoice, VendorInvoiceItem, InvoiceFlag } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatCurrency } from "@/lib/utils/format";
import { EstimateForm } from "@/components/vendors/estimate-form";
import { PoSignature } from "@/components/vendors/po-signature";
import { PO_DOC_REF_HEIGHT } from "@/components/budget/po-field-placer";
import {
  X, FileText, Check, CheckCircle2, Lock, Upload, AlertTriangle,
  CornerDownLeft, ExternalLink, PenLine, Download, GripVertical,
  Pencil, Plus, Trash2,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type StepState = "locked" | "active" | "done";

function getStepStates(status: CampaignVendorStatus): [StepState, StepState, StepState] {
  if (status === "Rejected") return ["active", "locked", "locked"];
  const step0Done = !["Invited", "Estimate Submitted"].includes(status);
  const step1Done = ["Shoot Complete", "Invoice Submitted", "Invoice Pre-Approved", "Invoice Approved", "Paid"].includes(status);
  const step2Done = ["Invoice Approved", "Paid"].includes(status);
  return [
    step0Done ? "done" : "active",
    step0Done ? (step1Done ? "done" : "active") : "locked",
    step1Done ? (step2Done ? "done" : "active") : "locked",
  ];
}

function getDefaultStep(status: CampaignVendorStatus): number {
  if (["Estimate Approved", "PO Uploaded", "PO Signed"].includes(status)) return 1;
  if (["Shoot Complete", "Invoice Submitted", "Invoice Pre-Approved", "Invoice Approved", "Paid"].includes(status)) return 2;
  return 0;
}

function resolveDocUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/") && typeof window !== "undefined") return `${window.location.origin}${url}`;
  return url;
}

function proxyDocUrl(resolved: string | null): string | null {
  if (!resolved) return null;
  if (typeof window !== "undefined" && !resolved.startsWith(window.location.origin)) {
    return `/api/document-proxy?url=${encodeURIComponent(resolved)}`;
  }
  return resolved;
}

const SEVERITY_STYLE: Record<string, { color: string; backgroundColor: string }> = {
  high: { color: "var(--status-rejected-fg)", backgroundColor: "var(--status-rejected-tint)" },
  medium: { color: "var(--status-pending-fg)", backgroundColor: "var(--status-pending-tint)" },
  low: { color: "var(--status-info-fg)", backgroundColor: "var(--status-info-tint)" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepHeader({
  number, label, state, selected, onClick,
}: {
  number: number; label: string; state: StepState; selected: boolean; onClick?: () => void;
}) {
  const canClick = state !== "locked" && !!onClick;
  return (
    <button
      type="button"
      onClick={canClick ? onClick : undefined}
      disabled={!canClick}
      className={`w-full flex items-center gap-3 text-left transition-colors ${canClick ? "hover:text-primary" : "cursor-default"}`}
    >
      <div
        style={
          state === "done"
            ? { color: "var(--status-approved-fg)", backgroundColor: "var(--status-approved-tint)" }
            : undefined
        }
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
          state === "done"
            ? ""
            : state === "active"
            ? selected ? "bg-primary text-white" : "bg-primary/10 text-primary"
            : "bg-surface-tertiary text-text-disabled"
        }`}
      >
        {state === "done" ? <Check className="h-3.5 w-3.5" /> : state === "locked" ? <Lock className="h-3 w-3" /> : number}
      </div>
      <span className={`text-sm font-semibold uppercase tracking-wider ${
        state === "locked" ? "text-text-disabled" : state === "done" ? "text-text-secondary" : "text-text-primary"
      }`}>
        {label}
      </span>
      {state === "active" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
    </button>
  );
}

function StepCard({ stepIndex, state, label, content, selectedStep, onSelect }: {
  stepIndex: number; state: StepState; label: string; content: React.ReactNode;
  selectedStep: number; onSelect: (i: number) => void;
}) {
  const isSelected = selectedStep === stepIndex;
  return (
    <div className={`rounded-lg border transition-colors ${
      state === "locked"
        ? "border-border bg-surface-secondary opacity-50"
        : isSelected
        ? "border-primary/40 bg-primary/5"
        : "border-border bg-surface hover:border-border-strong cursor-pointer"
    }`}>
      <div className="px-3.5 py-3">
        <StepHeader
          number={stepIndex + 1}
          label={label}
          state={state}
          selected={isSelected}
          onClick={state !== "locked" ? () => onSelect(stepIndex) : undefined}
        />
        {content}
      </div>
    </div>
  );
}

function DocViewer({ url, fileName, onRefresh }: { url: string | null; fileName?: string; onRefresh?: () => void }) {
  const [loadError, setLoadError] = useState(false);
  const resolved = resolveDocUrl(url);
  const proxied = proxyDocUrl(resolved);

  useEffect(() => { setLoadError(false); }, [url]);

  if (!url || !resolved) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <FileText className="h-10 w-10 text-text-disabled" />
        <p className="text-sm text-text-tertiary">No document yet for this step.</p>
      </div>
    );
  }

  const displayName = fileName || "Document";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border shrink-0 bg-surface-secondary">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
          <span className="text-xs font-medium text-text-primary truncate">{displayName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={resolved}
            download={displayName}
            className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
          <a
            href={resolved}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            New tab
          </a>
        </div>
      </div>
      <div className="flex-1 relative">
        {loadError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <p className="text-sm text-text-secondary">The document could not be loaded.</p>
            <a href={resolved} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
              Open in new tab <ExternalLink className="h-3 w-3" />
            </a>
            {onRefresh && (
              <Button size="sm" variant="secondary" onClick={() => { setLoadError(false); onRefresh(); }}>
                Refresh
              </Button>
            )}
          </div>
        ) : (
          <iframe
            key={proxied || resolved}
            src={proxied || resolved}
            title={displayName}
            className="w-full h-full border-0"
            onError={() => setLoadError(true)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  campaignVendor: CampaignVendor;
  campaignId: string;
  wfNumber: string;
  onStatusChange: () => void;
}

export function VendorLifecycleModal({ open, onClose, campaignVendor: cv, campaignId, wfNumber, onStatusChange }: Props) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const isVendor = user?.role === "Vendor";
  const isProducer = user?.role === "Producer" || user?.role === "Post Producer" || user?.role === "Admin";
  const isHop = user?.role === "Admin";

  // Local status so the modal stays open and advances steps after transitions
  const [localStatus, setLocalStatus] = useState<CampaignVendorStatus>(cv.status);

  const [selectedStep, setSelectedStep] = useState(() => getDefaultStep(cv.status));
  const [viewingDoc, setViewingDoc] = useState<"estimate" | "po" | "invoice">(() =>
    getDefaultStep(cv.status) === 2 ? "invoice" : getDefaultStep(cv.status) === 1 ? "po" : "estimate"
  );
  const [showEstimateForm, setShowEstimateForm] = useState(false);
  const [showPoSignature, setShowPoSignature] = useState(false);
  const [acting, setActing] = useState(false);
  const [sendingBack, setSendingBack] = useState(false);
  const [sendBackReason, setSendBackReason] = useState("");
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [editingItems, setEditingItems] = useState(false);
  const [draftItems, setDraftItems] = useState<{ id: string; description: string; quantity: number; unitPrice: number; amount: number; category: string }[]>([]);
  const [savingItems, setSavingItems] = useState(false);
  const invoiceFileInputRef = useRef<HTMLInputElement>(null);
  const placementRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 });
  const [sigPos, setSigPos] = useState({ x: cv.signatureFieldX ?? 10, y: cv.signatureFieldY ?? 68 });

  // Sync local status when parent prop changes (e.g. external refresh)
  useEffect(() => { setLocalStatus(cv.status); }, [cv.status]);

  // Advance step when local status changes
  useEffect(() => {
    const step = getDefaultStep(localStatus);
    setSelectedStep(step);
    setViewingDoc(step === 2 ? "invoice" : step === 1 ? "po" : "estimate");
    setShowEstimateForm(false);
    setShowPoSignature(false);
    setSendingBack(false);
    setSendBackReason("");
  }, [localStatus]);

  // Drag handler for signature field placement
  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOff({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      if (!placementRef.current) return;
      const rect = placementRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(95, ((e.clientX - rect.left - dragOff.x) / rect.width) * 100));
      const y = Math.max(0, Math.min(95, ((e.clientY - rect.top - dragOff.y) / PO_DOC_REF_HEIGHT) * 100));
      setSigPos({ x, y });
    }
    function onUp() { setDragging(false); }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, dragOff]);


  // Escape key + body scroll lock
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Data fetches
  const { data: cvData, mutate: mutateCv } = useSWR<{
    estimateItems: VendorEstimateItem[];
    estimateFileUrl: string | null;
    estimateFileName: string | null;
  }>(open ? `/api/campaign-vendors/${cv.id}` : null, fetcher);

  const { data: invoiceData, mutate: mutateInvoice } = useSWR<{
    invoice: VendorInvoice | null;
    items: VendorInvoiceItem[];
  }>(open ? `/api/invoices?campaignVendorId=${cv.id}` : null, fetcher);

  const estimateItems = cvData?.estimateItems || [];
  const invoice = invoiceData?.invoice;
  const invoiceItems = invoiceData?.items || [];

  const [s0, s1, s2] = getStepStates(localStatus);

  // Document URL per step
  const estimateDocUrl = cvData?.estimateFileUrl || (estimateItems.length > 0 ? `/estimates/${cv.id}` : null);
  const estimateDocName = cvData?.estimateFileName || `${cv.vendor?.companyName || "Vendor"} Estimate`;
  // Show the generated PO — always use /po/[id] so it renders with live signature data
  const isSigned = !!cv.poSignedAt;
  const poDocUrl = `/po/${cv.id}`;
  const poDocName = `${cv.vendor?.companyName || "Vendor"} ${isSigned ? "Signed PO" : "PO"}${cv.poNumber ? ` — ${cv.poNumber}` : ""}`;
  const invoiceDocUrl = invoice
    ? (invoice.storagePath && invoice.fileUrl && !invoice.fileUrl.startsWith("internal")
        ? invoice.fileUrl
        : `/invoices/${cv.id}`)
    : null;
  const invoiceDocName = invoice?.fileName || `${cv.vendor?.companyName || "Vendor"} Invoice`;

  const activeDocUrl =
    selectedStep === 0 ? estimateDocUrl
    : selectedStep === 1 ? poDocUrl
    : invoiceDocUrl;
  const activeDocName =
    selectedStep === 0 ? estimateDocName
    : selectedStep === 1 ? poDocName
    : invoiceDocName;

  // ─── Action handlers ───────────────────────────────────────────────────────

  async function transition(targetStatus: CampaignVendorStatus, payload?: Record<string, unknown>) {
    setActing(true);
    try {
      const res = await fetch(`/api/campaign-vendors/${cv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transition", targetStatus, payload }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed");
      }
      await mutateCv();
      onStatusChange();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Action failed");
    } finally {
      setActing(false);
    }
  }

  async function handleApproveEstimate() {
    await transition("Estimate Approved");
    toast("success", "Estimate approved");
    setSendingBack(false);
  }

  async function handleSendPO() {
    await transition("PO Uploaded", {
      signatureFieldX: sigPos.x,
      signatureFieldY: sigPos.y,
      poAuthorizedBy: user?.name || "Producer",
      poAuthorizedAt: new Date().toISOString(),
    });
    toast("success", "PO sent for signature");
  }

  async function handleSendBack() {
    if (!sendBackReason.trim()) return;
    setActing(true);
    try {
      const res = await fetch(`/api/campaign-vendors/${cv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transition", targetStatus: "Rejected", payload: { notes: sendBackReason.trim() } }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Sent back to vendor");
      setSendingBack(false);
      setSendBackReason("");
      onStatusChange();
    } catch {
      toast("error", "Failed to send back");
    } finally {
      setActing(false);
    }
  }

  async function handleInvoiceUpload(file: File) {
    setUploadingInvoice(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("campaignVendorId", cv.id);
      const res = await fetch("/api/invoices", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      toast("success", "Invoice uploaded");
      mutateInvoice();
      onStatusChange();
    } catch {
      toast("error", "Failed to upload invoice");
    } finally {
      setUploadingInvoice(false);
    }
  }

  async function handleApproveInvoice(type: "producer" | "hop") {
    if (!invoice) return;
    setActing(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id, campaignVendorId: cv.id, approverType: type }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Invoice approved");
      mutateInvoice();
      onStatusChange();
    } catch {
      toast("error", "Failed to approve invoice");
    } finally {
      setActing(false);
    }
  }

  function startEditItems() {
    setDraftItems(estimateItems.map((i) => ({
      id: i.id,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      amount: i.amount,
      category: i.category || "",
    })));
    setEditingItems(true);
  }

  function updateDraftItem(idx: number, field: "description" | "quantity" | "unitPrice" | "category", value: string) {
    setDraftItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: field === "description" || field === "category" ? value : Number(value) || 0 };
      if (field === "quantity" || field === "unitPrice") {
        updated.amount = Math.round(updated.quantity * updated.unitPrice * 100) / 100;
      }
      return updated;
    }));
  }

  function addDraftRow() {
    setDraftItems((prev) => [...prev, { id: `new-${Date.now()}`, description: "", quantity: 1, unitPrice: 0, amount: 0, category: "" }]);
  }

  function removeDraftRow(idx: number) {
    setDraftItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveEstimateItems() {
    setSavingItems(true);
    try {
      const res = await fetch(`/api/campaign-vendors/${cv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_estimate_items",
          items: draftItems.map((d) => ({
            description: d.description,
            quantity: d.quantity,
            unitPrice: d.unitPrice,
            amount: d.amount,
            category: d.category || null,
          })),
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await mutateCv();
      setEditingItems(false);
      toast("success", "Estimate updated");
    } catch {
      toast("error", "Failed to save estimate items");
    } finally {
      setSavingItems(false);
    }
  }

  if (!open) return null;

  const displayPoNumber = cv.poNumber || `PO${wfNumber}`;

  const vendorName = cv.vendor?.companyName || "Vendor";
  const vendorCategory = cv.vendor?.category;
  const isPdfEstimate = estimateItems.length === 1 && estimateItems[0]?.description?.startsWith("Per attached:");

  // ─── Step 0: Estimate content ─────────────────────────────────────────────

  function renderStep0Content() {
    if (showEstimateForm) {
      return (
        <div className="mt-3 pt-3 border-t border-border">
          <EstimateForm
            campaignVendorId={cv.id}
            campaignId={campaignId}
            onSubmitted={() => { setShowEstimateForm(false); mutateCv(); onStatusChange(); }}
            onCancel={() => setShowEstimateForm(false)}
          />
        </div>
      );
    }

    // Vendor — invited (no estimate yet)
    if (isVendor && localStatus === "Invited") {
      return (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-text-tertiary mb-3">Submit your estimate as a PDF upload or itemized line items.</p>
          <Button size="sm" onClick={() => setShowEstimateForm(true)}>
            <FileText className="h-3.5 w-3.5" />
            Submit Estimate
          </Button>
        </div>
      );
    }

    // Vendor — estimate submitted (waiting for review)
    if (isVendor && localStatus === "Estimate Submitted") {
      return (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <p className="text-xs text-text-secondary">Submitted — waiting for producer review.</p>
          {cvData?.estimateFileUrl && (
            <a href={cvData.estimateFileUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <FileText className="h-3 w-3" /> View your submitted estimate <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            onClick={() => setShowEstimateForm(true)}
            className="block text-xs text-text-tertiary hover:text-text-secondary"
          >
            Withdraw &amp; resubmit
          </button>
        </div>
      );
    }

    // Vendor — estimate approved
    if (isVendor && s0 === "done") {
      return (
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <p className="text-xs text-text-secondary">
            Approved{cv.estimateTotal > 0 ? ` — ${formatCurrency(cv.estimateTotal)}` : ""}
          </p>
        </div>
      );
    }

    // Producer — estimate submitted
    if (isProducer && localStatus === "Estimate Submitted") {
      const displayItems = editingItems ? draftItems : estimateItems;
      const total = displayItems.reduce((s, i) => s + i.amount, 0);
      return (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {/* Line items */}
          {!isPdfEstimate && (estimateItems.length > 0 || editingItems) && (
            <div className="space-y-1.5">
              {/* Edit / save header */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Line Items</span>
                {!editingItems ? (
                  <button
                    onClick={startEditItems}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-text-tertiary hover:text-primary transition-colors"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingItems(false)}
                      className="text-[10px] text-text-tertiary hover:text-text-secondary"
                    >
                      Cancel
                    </button>
                    <Button size="sm" onClick={saveEstimateItems} loading={savingItems} disabled={savingItems}>
                      Save
                    </Button>
                  </div>
                )}
              </div>

              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-text-tertiary">
                    <th className="text-left py-1.5 font-medium">Description</th>
                    <th className="text-right py-1.5 font-medium w-10">Qty</th>
                    <th className="text-right py-1.5 font-medium w-16">Unit</th>
                    <th className="text-right py-1.5 font-medium w-16">Total</th>
                    {editingItems && <th className="w-5" />}
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((item, idx) => (
                    <tr key={item.id} className="border-b border-border-light">
                      {editingItems ? (
                        <>
                          <td className="py-1 pr-1">
                            <input
                              type="text"
                              value={(item as typeof draftItems[number]).description}
                              onChange={(e) => updateDraftItem(idx, "description", e.target.value)}
                              className="w-full text-xs bg-surface-secondary border border-border rounded px-1.5 py-0.5 text-text-primary focus:outline-none"
                              placeholder="Description"
                            />
                          </td>
                          <td className="py-1 pr-1">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={(item as typeof draftItems[number]).quantity}
                              onChange={(e) => updateDraftItem(idx, "quantity", e.target.value)}
                              className="w-full text-xs bg-surface-secondary border border-border rounded px-1.5 py-0.5 text-right text-text-primary focus:outline-none"
                            />
                          </td>
                          <td className="py-1 pr-1">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={(item as typeof draftItems[number]).unitPrice}
                              onChange={(e) => updateDraftItem(idx, "unitPrice", e.target.value)}
                              className="w-full text-xs bg-surface-secondary border border-border rounded px-1.5 py-0.5 text-right text-text-primary focus:outline-none"
                            />
                          </td>
                          <td className="py-1 text-right font-medium text-text-primary">
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="py-1 pl-1">
                            <button
                              onClick={() => removeDraftRow(idx)}
                              className="text-text-disabled hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-1.5 text-text-primary">{item.description}</td>
                          <td className="py-1.5 text-right text-text-secondary">{item.quantity}</td>
                          <td className="py-1.5 text-right text-text-secondary">{formatCurrency(item.unitPrice)}</td>
                          <td className="py-1.5 text-right font-medium text-text-primary">{formatCurrency(item.amount)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-semibold">
                    <td colSpan={editingItems ? 3 : 3} className="py-1.5 text-text-primary">Total</td>
                    <td className="py-1.5 text-right text-text-primary">{formatCurrency(total)}</td>
                    {editingItems && <td />}
                  </tr>
                </tfoot>
              </table>

              {editingItems && (
                <button
                  onClick={addDraftRow}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-text-tertiary hover:text-primary transition-colors pt-0.5"
                >
                  <Plus className="h-3 w-3" /> Add row
                </button>
              )}
            </div>
          )}
          {isPdfEstimate && (
            <p className="text-xs text-text-tertiary">PDF estimate — see document viewer.</p>
          )}
          {estimateItems.length === 0 && !editingItems && (
            <p className="text-xs text-text-tertiary">Loading estimate details…</p>
          )}

          {/* Actions */}
          {!sendingBack && !editingItems && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSendingBack(true)}
                disabled={acting}
                className="text-xs text-text-tertiary hover:text-destructive font-medium disabled:opacity-50"
              >
                Send Back
              </button>
              <Button size="sm" variant="secondary" onClick={handleApproveEstimate} disabled={acting} loading={acting}>
                <Check className="h-3.5 w-3.5" />
                Approve Estimate
              </Button>
            </div>
          )}
          {sendingBack && (
            <div className="space-y-2">
              <textarea
                value={sendBackReason}
                onChange={(e) => setSendBackReason(e.target.value)}
                placeholder="Explain what needs to change…"
                className="w-full text-xs rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none resize-none"
                rows={3}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={handleSendBack} disabled={!sendBackReason.trim() || acting} loading={acting}>
                  <CornerDownLeft className="h-3 w-3" />
                  Send Back
                </Button>
                <button onClick={() => { setSendingBack(false); setSendBackReason(""); }}
                  className="text-xs text-text-tertiary hover:text-text-secondary">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Producer — estimate approved (step done summary)
    if (isProducer && s0 === "done") {
      return (
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <p className="text-xs text-text-secondary">
            Approved{cv.estimateTotal > 0 ? ` — ${formatCurrency(cv.estimateTotal)}` : ""}
          </p>
        </div>
      );
    }

    return null;
  }

  // ─── Step 1: PO content ───────────────────────────────────────────────────

  function renderStep1Content() {
    if (s1 === "locked") {
      return (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-text-disabled">Available after estimate is approved.</p>
        </div>
      );
    }

    // PO is done (shoot complete or later)
    if (s1 === "done") {
      return (
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <p className="text-xs text-text-secondary">
            PO signed{cv.poNumber ? ` — ${cv.poNumber}` : ""}{cv.signatureName ? ` by ${cv.signatureName}` : ""}
          </p>
        </div>
      );
    }

    // Vendor — PO uploaded, needs signing
    if (isVendor && localStatus === "PO Uploaded") {
      if (showPoSignature) {
        return (
          <div className="mt-3 pt-3 border-t border-border">
            <PoSignature
              campaignVendorId={cv.id}
              poFileUrl={cv.poFileUrl}
              onSigned={() => { setShowPoSignature(false); onStatusChange(); }}
              onCancel={() => setShowPoSignature(false)}
            />
          </div>
        );
      }
      return (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <p className="text-xs text-text-secondary">Your PO is ready. Review the document and sign below.</p>
          <Button size="sm" onClick={() => { setShowPoSignature(true); setSelectedStep(1); }}>
            <PenLine className="h-3.5 w-3.5" />
            Sign Purchase Order
          </Button>
        </div>
      );
    }

    // Vendor — PO signed, waiting for shoot
    if (isVendor && localStatus === "PO Signed") {
      return (
        <div className="mt-3 pt-3 border-t border-border space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <p className="text-xs text-text-secondary">PO signed{cv.signatureName ? ` by ${cv.signatureName}` : ""}. Waiting for shoot date.</p>
          </div>
        </div>
      );
    }

    // Vendor — waiting for PO
    if (isVendor) {
      return (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-text-secondary">Waiting for the producer to upload your PO.</p>
        </div>
      );
    }

    // Producer — ready to send PO
    if (isProducer && localStatus === "Estimate Approved") {
      return (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          <p className="text-xs text-text-secondary">
            The PO is generated from the approved estimate. Drag the signature field to where you want the vendor to sign, then send.
          </p>
          <Button size="sm" onClick={handleSendPO} loading={acting} disabled={acting}>
            <PenLine className="h-3.5 w-3.5" />
            Send for Signature
          </Button>
        </div>
      );
    }

    // Producer — PO uploaded, waiting for vendor to sign
    if (isProducer && localStatus === "PO Uploaded") {
      return (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <p className="text-xs text-text-secondary">PO uploaded{cv.poNumber ? ` (${cv.poNumber})` : ""}. Waiting for vendor signature.</p>
        </div>
      );
    }

    // Producer — PO signed (vendor will submit invoice directly)
    if (isProducer && localStatus === "PO Signed") {
      return (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <p className="text-xs text-text-secondary">Signed{cv.signatureName ? ` by ${cv.signatureName}` : ""}. Waiting for vendor invoice.</p>
          </div>
        </div>
      );
    }

    return null;
  }

  // ─── Step 2: Invoice content ──────────────────────────────────────────────

  function renderStep2Content() {
    if (s2 === "locked") {
      return (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-text-disabled">Available after shoot is complete.</p>
        </div>
      );
    }

    // Vendor — shoot complete or PO signed, upload invoice
    if (isVendor && (localStatus === "Shoot Complete" || localStatus === "PO Signed")) {
      return (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <p className="text-xs text-text-secondary">Your PO is signed. Upload your invoice to begin payment processing.</p>
          <input
            ref={invoiceFileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleInvoiceUpload(f); e.target.value = ""; }}
          />
          <Button size="sm" loading={uploadingInvoice} onClick={() => invoiceFileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
            Upload Invoice
          </Button>
        </div>
      );
    }

    // Vendor — invoice submitted or later
    if (isVendor) {
      const isProducerApproved = !!invoice?.producerApprovedAt;
      const isHopApproved = !!invoice?.hopApprovedAt;
      const statusText = isHopApproved
        ? "Fully approved — payment in progress"
        : isProducerApproved
        ? "Producer approved, waiting finance review"
        : "Submitted — under review";

      return (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <p className="text-xs text-text-secondary">{statusText}</p>
          {invoice?.fileUrl && (
            <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <FileText className="h-3 w-3" /> {invoice.fileName} <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {localStatus === "Paid" && cv.paymentAmount > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <p className="text-xs font-medium text-success">
                Paid {formatCurrency(cv.paymentAmount)}{cv.paymentDate ? ` on ${new Date(cv.paymentDate).toLocaleDateString("en-US")}` : ""}
              </p>
            </div>
          )}
        </div>
      );
    }

    // Producer — invoice submitted, needs review
    const estimateTotal = estimateItems.reduce((s, i) => s + i.amount, 0);
    const invoiceTotal = invoiceItems.reduce((s, i) => s + i.amount, 0);
    const diff = invoiceTotal - estimateTotal;
    const diffPct = estimateTotal > 0 ? (diff / estimateTotal) * 100 : 0;
    const isProducerApproved = !!invoice?.producerApprovedAt;
    const isHopApproved = !!invoice?.hopApprovedAt;

    if (!invoice && isProducer) {
      if (localStatus === "Shoot Complete") {
        // Producer can also upload invoice on behalf
        return (
          <div className="mt-3 pt-3 border-t border-border space-y-2">
            <p className="text-xs text-text-secondary">Waiting for the vendor to submit their invoice.</p>
            <input
              ref={invoiceFileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleInvoiceUpload(f); e.target.value = ""; }}
            />
            <Button size="sm" variant="secondary" loading={uploadingInvoice} onClick={() => invoiceFileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              Upload Invoice
            </Button>
          </div>
        );
      }
      return (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-text-tertiary">No invoice submitted yet.</p>
        </div>
      );
    }

    if (isProducer && invoice) {
      return (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {/* Approval status — linear flow */}
          <div className="flex items-center gap-2 text-xs">
            <span className={`flex items-center gap-1 ${isProducerApproved ? "text-success font-medium" : "text-text-tertiary"}`}>
              {isProducerApproved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border border-current inline-block" />}
              Producer
            </span>
            <span className="text-text-tertiary">→</span>
            <span className={`flex items-center gap-1 ${isHopApproved ? "text-success font-medium" : "text-text-tertiary"}`}>
              {isHopApproved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border border-current inline-block" />}
              Finance
            </span>
          </div>

          {/* Flags */}
          {invoice.autoFlags && invoice.autoFlags.length > 0 && (
            <div className="space-y-1.5">
              {invoice.autoFlags.map((flag: InvoiceFlag, i: number) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-surface-secondary p-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide"
                        style={SEVERITY_STYLE[flag.severity]}
                      >
                        {flag.severity}
                      </span>
                      <span className="text-xs font-medium text-text-primary">{flag.type}</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">{flag.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Invoice line items */}
          {invoiceItems.length > 0 && (
            <div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-text-tertiary">
                    <th className="text-left py-1.5 font-medium">Description</th>
                    <th className="text-right py-1.5 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border-light"
                      style={item.flagged ? { backgroundColor: "var(--status-rejected-tint)" } : undefined}
                    >
                      <td className="py-1.5 text-text-primary">
                        {item.description}{item.flagged && <span className="ml-1 text-red-500">⚑</span>}
                      </td>
                      <td className="py-1.5 text-right font-medium text-text-primary">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-semibold">
                    <td className="py-1.5 text-text-primary">Total</td>
                    <td className="py-1.5 text-right text-text-primary">{formatCurrency(invoiceTotal)}</td>
                  </tr>
                </tfoot>
              </table>
              {/* vs. estimate summary */}
              {estimateTotal > 0 && (
                <div className={`mt-2 text-xs flex items-center gap-1.5 ${diff > 0 ? "text-error" : diff < 0 ? "text-success" : "text-text-tertiary"}`}>
                  {diff > 0 ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <CheckCircle2 className="h-3 w-3 shrink-0" />}
                  {diff === 0
                    ? `Matches estimate (${formatCurrency(estimateTotal)})`
                    : `${diff > 0 ? "+" : ""}${formatCurrency(diff)} vs. estimate (${formatCurrency(estimateTotal)})`}
                  {diffPct !== 0 && <span className="text-text-tertiary">· {diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}%</span>}
                </div>
              )}
            </div>
          )}

          {/* Approval actions */}
          {!isProducerApproved && !sendingBack && isProducer && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSendingBack(true)}
                disabled={acting}
                className="text-xs text-text-tertiary hover:text-destructive font-medium disabled:opacity-50"
              >
                Send Back
              </button>
              <Button size="sm" variant="secondary" loading={acting} onClick={() => handleApproveInvoice("producer")}>
                <Check className="h-3.5 w-3.5" />
                Approve Invoice
              </Button>
            </div>
          )}
          {isProducerApproved && !isHopApproved && isHop && !sendingBack && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSendingBack(true)}
                disabled={acting}
                className="text-xs text-text-tertiary hover:text-destructive font-medium disabled:opacity-50"
              >
                Send Back
              </button>
              <Button size="sm" loading={acting} onClick={() => handleApproveInvoice("hop")}>
                <Check className="h-3.5 w-3.5" />
                Final Approve
              </Button>
            </div>
          )}
          {isHopApproved && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <p className="text-xs text-success font-medium">Fully approved</p>
            </div>
          )}
          {sendingBack && (
            <div className="space-y-2">
              <textarea
                value={sendBackReason}
                onChange={(e) => setSendBackReason(e.target.value)}
                placeholder="Explain what needs to change…"
                className="w-full text-xs rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none resize-none"
                rows={3}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={handleSendBack} disabled={!sendBackReason.trim() || acting} loading={acting}>
                  <CornerDownLeft className="h-3 w-3" />
                  Send Back
                </Button>
                <button onClick={() => { setSendingBack(false); setSendBackReason(""); }}
                  className="text-xs text-text-tertiary hover:text-text-secondary">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-[1044px] flex flex-col bg-surface border border-border rounded-xl shadow-2xl overflow-hidden mt-4"
        style={{ height: "calc(100vh - 3rem)" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 bg-surface">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-text-primary truncate">{vendorName}</h2>
            <p className="text-xs text-text-tertiary truncate">
              {vendorCategory ? `${vendorCategory} · ` : ""}Estimate → PO → Invoice
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors p-1 rounded-md hover:bg-surface-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left: step cards */}
          <div className="w-[410px] shrink-0 border-r border-border flex flex-col gap-3 p-4 overflow-y-auto">
            <StepCard stepIndex={0} state={s0} label="Estimate" content={renderStep0Content()} selectedStep={selectedStep} onSelect={setSelectedStep} />
            <StepCard stepIndex={1} state={s1} label="PO" content={renderStep1Content()} selectedStep={selectedStep} onSelect={setSelectedStep} />
            <StepCard stepIndex={2} state={s2} label="Invoice" content={renderStep2Content()} selectedStep={selectedStep} onSelect={setSelectedStep} />
          </div>

          {/* Right: document viewer */}
          <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
            {/* Document tab strip — producer only, when multiple docs are available */}
            {isProducer && localStatus !== "Estimate Approved" && s0 === "done" && (
              <div className="flex items-center gap-0 border-b border-border bg-surface-secondary shrink-0 px-3">
                {estimateDocUrl && (
                  <button
                    type="button"
                    onClick={() => setViewingDoc("estimate")}
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      viewingDoc === "estimate"
                        ? "border-primary text-primary"
                        : "border-transparent text-text-tertiary hover:text-text-secondary"
                    }`}
                  >
                    Estimate
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingDoc("po")}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    viewingDoc === "po"
                      ? "border-primary text-primary"
                      : "border-transparent text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  {isSigned ? "Signed PO" : "PO"}
                </button>
                {invoiceDocUrl && (
                  <button
                    type="button"
                    onClick={() => setViewingDoc("invoice")}
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      viewingDoc === "invoice"
                        ? "border-primary text-primary"
                        : "border-transparent text-text-tertiary hover:text-text-secondary"
                    }`}
                  >
                    Invoice
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {isProducer && localStatus === "Estimate Approved" ? (
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border shrink-0 bg-surface-secondary">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                      <span className="text-xs font-medium text-text-primary truncate">{estimateDocName}</span>
                    </div>
                    {estimateDocUrl && (
                      <a href={proxyDocUrl(resolveDocUrl(estimateDocUrl)) || estimateDocUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors shrink-0">
                        <ExternalLink className="h-3 w-3" />
                        New tab
                      </a>
                    )}
                  </div>
                  {/* Placement canvas */}
                  <div className="flex-1 overflow-y-auto">
                    <div
                      ref={placementRef}
                      className="relative"
                      style={{ height: PO_DOC_REF_HEIGHT }}
                    >
                      <iframe
                        src={`/po/${cv.id}?placement=1`}
                        title={estimateDocName}
                        className="w-full border-0"
                        style={{ height: PO_DOC_REF_HEIGHT, pointerEvents: dragging ? "none" : "auto" }}
                      />
                      {/* Signature placement field */}
                      <div
                        style={{ position: "absolute", left: `${sigPos.x}%`, top: `${(sigPos.y / 100) * PO_DOC_REF_HEIGHT}px`, zIndex: 10 }}
                        onMouseDown={startDrag}
                        className="cursor-grab active:cursor-grabbing select-none"
                      >
                        <div className={`flex items-center gap-2 rounded-md border-2 border-dashed px-3 py-2 transition-colors ${
                          dragging ? "border-primary bg-primary/10" : "border-primary/60 bg-primary/5 hover:border-primary"
                        }`}>
                          <GripVertical className="h-4 w-4 text-primary/50 shrink-0" />
                          <span className="text-sm font-medium text-primary">Vendor Signature</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Hint strip */}
                  <div className="px-3 py-1.5 border-t border-border bg-surface-secondary shrink-0">
                    <p className="text-[10px] text-text-tertiary">Drag the signature field to where you want the vendor to sign, then click "Send for Signature".</p>
                  </div>
                </div>
              ) : (
                <DocViewer
                  url={
                    isProducer && s0 === "done"
                      ? (viewingDoc === "estimate" ? estimateDocUrl
                        : viewingDoc === "po" ? poDocUrl
                        : invoiceDocUrl)
                      : activeDocUrl
                  }
                  fileName={
                    isProducer && s0 === "done"
                      ? (viewingDoc === "estimate" ? estimateDocName
                        : viewingDoc === "po" ? poDocName
                        : invoiceDocName)
                      : activeDocName
                  }
                  onRefresh={viewingDoc === "invoice" || selectedStep === 2 ? () => mutateInvoice() : undefined}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
