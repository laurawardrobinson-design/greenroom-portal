"use client";

import { useState } from "react";
import useSWR from "swr";
import type { VendorEstimateItem, VendorInvoice, VendorInvoiceItem } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatCurrency } from "@/lib/utils/format";
import { FileText, AlertTriangle, Check, CheckCircle2, CornerDownLeft, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SEVERITY_BADGE: Record<string, string> = {
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-blue-50 text-blue-700",
};

interface Props {
  campaignVendorId: string;
  status: string;
  onStatusChange: () => void;
}

export function LineItemComparisonPanel({ campaignVendorId, status, onStatusChange }: Props) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [acting, setActing] = useState(false);
  const [sendingBack, setSendingBack] = useState(false);
  const [reason, setReason] = useState("");
  const [editingEstimate, setEditingEstimate] = useState(false);
  const [editRows, setEditRows] = useState<{ description: string; amount: string }[]>([]);
  const [savingEstimate, setSavingEstimate] = useState(false);

  const { data: cvData, mutate: mutateCv } = useSWR<{ estimateItems: VendorEstimateItem[] }>(
    `/api/campaign-vendors/${campaignVendorId}`,
    fetcher
  );

  const { data: invData, mutate: mutateInvoice } = useSWR<{
    invoice: VendorInvoice | null;
    items: VendorInvoiceItem[];
  }>(`/api/invoices?campaignVendorId=${campaignVendorId}`, fetcher);

  const estimateItems: VendorEstimateItem[] = cvData?.estimateItems || [];
  const invoice = invData?.invoice ?? null;
  const invoiceItems: VendorInvoiceItem[] = invData?.items || [];

  const isLoading = !cvData || !invData;

  // Detect PDF-only estimate (legacy pattern)
  const isPdfEstimate =
    estimateItems.length === 1 && estimateItems[0]?.description?.startsWith("Per attached:");
  const pdfEstimateFileName = isPdfEstimate
    ? estimateItems[0].description.replace("Per attached: ", "")
    : null;

  const estimateTotal = isPdfEstimate
    ? estimateItems[0]?.amount ?? 0
    : estimateItems.reduce((s, i) => s + i.amount, 0);
  const invoiceTotal = invoiceItems.reduce((s, i) => s + i.amount, 0);
  const diff = invoiceTotal - estimateTotal;
  const diffPct = estimateTotal > 0 ? (diff / estimateTotal) * 100 : 0;

  // Approval state
  const isProducerApproved = !!invoice?.producerApprovedAt;
  const isHopApproved = !!invoice?.hopApprovedAt;
  const canApproveEstimate =
    status === "Estimate Submitted" && (user?.role === "Producer" || user?.role === "Admin");
  const canApproveInvoiceProducer =
    status === "Invoice Submitted" &&
    !isProducerApproved &&
    (user?.role === "Producer" || user?.role === "Admin");
  const canApproveInvoiceHop =
    status === "Invoice Pre-Approved" && !isHopApproved && user?.role === "Admin";
  const canSendBack =
    (canApproveEstimate || canApproveInvoiceProducer) && !sendingBack;

  async function handleApproveEstimate() {
    setActing(true);
    try {
      const res = await fetch(`/api/campaign-vendors/${campaignVendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transition", targetStatus: "Estimate Approved" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Estimate approved");
      onStatusChange();
    } catch {
      toast("error", "Failed to approve estimate");
    } finally {
      setActing(false);
    }
  }

  async function handleApproveInvoice(type: "producer" | "hop") {
    setActing(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice!.id,
          campaignVendorId,
          approverType: type,
        }),
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

  function startEditEstimate() {
    setEditRows(estimateItems.map((i) => ({ description: i.description, amount: String(i.amount) })));
    setEditingEstimate(true);
  }

  function cancelEditEstimate() {
    setEditingEstimate(false);
    setEditRows([]);
  }

  async function saveEstimateItems() {
    const items = editRows
      .filter((r) => r.description.trim())
      .map((r) => ({ description: r.description.trim(), amount: parseFloat(r.amount) || 0 }));
    setSavingEstimate(true);
    try {
      const res = await fetch(`/api/campaign-vendors/${campaignVendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_estimate_items", items }),
      });
      if (!res.ok) throw new Error("Failed");
      await mutateCv();
      toast("success", "Estimate updated");
      setEditingEstimate(false);
      setEditRows([]);
    } catch {
      toast("error", "Failed to save estimate");
    } finally {
      setSavingEstimate(false);
    }
  }

  async function handleSendBack() {
    if (!reason.trim()) return;
    setActing(true);
    try {
      const res = await fetch(`/api/campaign-vendors/${campaignVendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transition",
          targetStatus: "Rejected",
          payload: { notes: reason.trim() },
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Sent back to vendor");
      onStatusChange();
    } catch {
      toast("error", "Failed to send back");
    } finally {
      setActing(false);
      setSendingBack(false);
      setReason("");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-text-tertiary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-xs">Loading…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-3">
      {/* Header row: label + action buttons */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          Line Items
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {/* Approval badges */}
          {isProducerApproved && !isHopApproved && (
            <div className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Producer approved
            </div>
          )}
          {isHopApproved && (
            <div className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              HOP approved
            </div>
          )}
          {/* Estimate actions */}
          {canApproveEstimate && !sendingBack && (
            <>
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
            </>
          )}
          {/* Invoice producer actions */}
          {canApproveInvoiceProducer && !sendingBack && (
            <>
              <button
                onClick={() => setSendingBack(true)}
                disabled={acting}
                className="text-xs text-text-tertiary hover:text-destructive font-medium disabled:opacity-50"
              >
                Send Back
              </button>
              <Button size="sm" variant="secondary" onClick={() => handleApproveInvoice("producer")} disabled={acting} loading={acting}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve Invoice
              </Button>
            </>
          )}
          {/* Invoice HOP actions */}
          {canApproveInvoiceHop && (
            <Button size="sm" onClick={() => handleApproveInvoice("hop")} disabled={acting} loading={acting}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              HOP Approve
            </Button>
          )}
        </div>
      </div>

      {/* Send-back textarea */}
      {sendingBack && (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain what needs to change…"
            className="w-full text-xs rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            rows={2}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSendBack}
              disabled={!reason.trim() || acting}
              loading={acting}
            >
              <CornerDownLeft className="h-3 w-3" />
              Send Back
            </Button>
            <button
              onClick={() => { setSendingBack(false); setReason(""); }}
              className="text-xs text-text-tertiary hover:text-text-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Auto-flags */}
      {invoice?.autoFlags && invoice.autoFlags.length > 0 && (
        <div className="space-y-1">
          {invoice.autoFlags.map((flag, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg bg-surface-secondary p-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="custom" className={SEVERITY_BADGE[flag.severity]}>
                    {flag.severity}
                  </Badge>
                  <span className="text-xs font-medium text-text-primary">{flag.type}</span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">{flag.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: Estimate */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Estimate
            </span>
            {!isPdfEstimate && !editingEstimate && (canApproveEstimate || user?.role === "Admin") && (
              <button
                onClick={startEditEstimate}
                className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-primary transition-colors"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            )}
          </div>

          {editingEstimate ? (
            <div className="space-y-1">
              {editRows.map((row, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={row.description}
                    onChange={(e) => {
                      const next = [...editRows];
                      next[i] = { ...next[i], description: e.target.value };
                      setEditRows(next);
                    }}
                    placeholder="Description"
                    className="flex-1 min-w-0 text-xs rounded border border-border bg-white px-1.5 py-1 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="number"
                    value={row.amount}
                    onChange={(e) => {
                      const next = [...editRows];
                      next[i] = { ...next[i], amount: e.target.value };
                      setEditRows(next);
                    }}
                    placeholder="0.00"
                    className="w-20 shrink-0 text-xs rounded border border-border bg-white px-1.5 py-1 text-right text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => setEditRows(editRows.filter((_, j) => j !== i))}
                    className="text-text-tertiary hover:text-destructive shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setEditRows([...editRows, { description: "", amount: "" }])}
                className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-primary mt-1"
              >
                <Plus className="h-3 w-3" />
                Add row
              </button>
              <div className="flex items-center gap-2 pt-1 border-t border-border">
                <Button size="sm" variant="secondary" onClick={saveEstimateItems} disabled={savingEstimate} loading={savingEstimate}>
                  Save
                </Button>
                <button onClick={cancelEditEstimate} className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary">
                  <X className="h-3 w-3" />
                  Cancel
                </button>
              </div>
            </div>
          ) : isPdfEstimate ? (
            <div className="flex items-center gap-2 py-2 text-xs text-text-secondary">
              <FileText className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
              <span>{pdfEstimateFileName}</span>
            </div>
          ) : estimateItems.length > 0 ? (
            <table className="w-full text-xs">
              <tbody>
                {estimateItems.map((item) => (
                  <tr key={item.id} className="border-b border-border-light">
                    <td className="py-1.5 pr-2 text-text-primary leading-snug">{item.description}</td>
                    <td className="py-1.5 text-right font-medium text-text-primary whitespace-nowrap">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td className="py-1.5 text-text-primary">Total</td>
                  <td className="py-1.5 text-right text-text-primary">{formatCurrency(estimateTotal)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="text-xs text-text-tertiary py-2">No line items.</p>
          )}
        </div>

        {/* Right: Invoice */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
            Invoice
          </div>
          {!invoice ? (
            <p className="text-xs text-text-tertiary py-2">No invoice yet.</p>
          ) : invoiceItems.length === 0 ? (
            <p className="text-xs text-text-tertiary py-2">No line items available for this invoice.</p>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {invoiceItems.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-b border-border-light ${item.flagged ? "bg-red-50/50" : ""}`}
                  >
                    <td className="py-1.5 pr-2 text-text-primary leading-snug">
                      {item.description}
                      {item.flagged && <span className="ml-1 text-red-500">⚑</span>}
                    </td>
                    <td className="py-1.5 text-right font-medium text-text-primary whitespace-nowrap">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td className="py-1.5 text-text-primary">Total</td>
                  <td className="py-1.5 text-right">
                    <span className="text-text-primary">{formatCurrency(invoiceTotal)}</span>
                    {diff !== 0 && (
                      <span
                        className={`block text-[10px] font-normal ${diff > 0 ? "text-red-600" : "text-emerald-600"}`}
                      >
                        {diff > 0 ? "+" : ""}
                        {formatCurrency(diff)}
                        {diffPct !== 0 && ` (${diffPct > 0 ? "+" : ""}${diffPct.toFixed(1)}%)`}
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
