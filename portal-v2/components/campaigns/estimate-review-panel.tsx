"use client";

import { useState } from "react";
import useSWR from "swr";
import type { VendorEstimateItem } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils/format";
import { Check, Loader2, FileText, CornerDownLeft } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  campaignVendorId: string;
  status: string;
  onStatusChange: () => void;
}

export function EstimateReviewPanel({ campaignVendorId, status, onStatusChange }: Props) {
  const { toast } = useToast();
  const [acting, setActing] = useState(false);
  const [sendingBack, setSendingBack] = useState(false);
  const [reason, setReason] = useState("");

  const { data } = useSWR<{ estimateItems: VendorEstimateItem[] }>(
    `/api/campaign-vendors/${campaignVendorId}`,
    fetcher
  );

  const items = data?.estimateItems || [];
  const isPdfUpload =
    items.length === 1 && items[0]?.description?.startsWith("Per attached:");
  const pdfFileName = isPdfUpload
    ? items[0].description.replace("Per attached: ", "")
    : null;
  const total = items.reduce((s, i) => s + i.amount, 0);
  const isPending = status === "Estimate Submitted";

  async function handleApprove() {
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
      toast("success", "Estimate sent back to vendor");
      onStatusChange();
    } catch {
      toast("error", "Failed to send back estimate");
    } finally {
      setActing(false);
      setSendingBack(false);
    }
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 py-4 text-text-tertiary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-xs">Loading estimate…</span>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      {/* Header row — filename/label + approve button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-text-tertiary" />
          {isPdfUpload && pdfFileName ? (
            <span className="text-sm font-medium text-text-primary">{pdfFileName}</span>
          ) : (
            <span className="text-sm font-medium text-text-primary">Estimate</span>
          )}
        </div>

        {isPending && !sendingBack && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setSendingBack(true)}
              disabled={acting}
              className="text-xs text-text-tertiary hover:text-destructive font-medium disabled:opacity-50"
            >
              Send Back
            </button>
            <Button size="sm" variant="secondary" onClick={handleApprove} disabled={acting} loading={acting}>
              <Check className="h-3.5 w-3.5" />
              Approve
            </Button>
          </div>
        )}
      </div>

      {/* Send Back textarea */}
      {sendingBack && (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain what needs to change…"
            className="w-full text-xs rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            rows={3}
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

      {/* Line items table */}
      {!isPdfUpload && items.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-text-tertiary">
              <th className="text-left py-1.5 font-medium">Description</th>
              <th className="text-right py-1.5 font-medium">Qty</th>
              <th className="text-right py-1.5 font-medium">Unit</th>
              <th className="text-right py-1.5 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border-light">
                <td className="py-1.5 text-text-primary">{item.description}</td>
                <td className="py-1.5 text-right text-text-secondary">{item.quantity}</td>
                <td className="py-1.5 text-right text-text-secondary">{formatCurrency(item.unitPrice)}</td>
                <td className="py-1.5 text-right font-medium text-text-primary">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-semibold">
              <td colSpan={3} className="py-1.5 text-text-primary">Total</td>
              <td className="py-1.5 text-right text-text-primary">{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>
      )}

      {items.length === 0 && !isPdfUpload && (
        <p className="text-xs text-text-tertiary">No line items on file.</p>
      )}
    </div>
  );
}
