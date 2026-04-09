"use client";

import { useState } from "react";
import useSWR from "swr";
import type { VendorInvoice, VendorInvoiceItem, VendorEstimateItem } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { PdfPreviewModal } from "@/components/budget/pdf-preview-modal";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatCurrency } from "@/lib/utils/format";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  CornerDownLeft,
  Eye,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SEVERITY_BADGE: Record<string, string> = {
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-blue-50 text-blue-700",
};

interface Props {
  campaignVendorId: string;
  onStatusChange: () => void;
}

function invoiceHref(invoice: VendorInvoice, campaignVendorId: string): string {
  // If stored in private storage bucket, use the signed URL; otherwise use our generated page
  if (invoice.storagePath && invoice.fileUrl && !invoice.fileUrl.startsWith("internal")) {
    return invoice.fileUrl;
  }
  return `/invoices/${campaignVendorId}`;
}

export function InvoiceReviewPanel({
  campaignVendorId,
  onStatusChange,
}: Props) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [approving, setApproving] = useState(false);
  const [sendingBack, setSendingBack] = useState(false);
  const [reason, setReason] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const { data, mutate } = useSWR<{
    invoice: VendorInvoice | null;
    items: VendorInvoiceItem[];
  }>(`/api/invoices?campaignVendorId=${campaignVendorId}`, fetcher);

  const { data: cvData } = useSWR<{ estimateItems: VendorEstimateItem[] }>(
    `/api/campaign-vendors/${campaignVendorId}`,
    fetcher
  );
  const estimateItems: VendorEstimateItem[] = cvData?.estimateItems || [];

  const invoice = data?.invoice;
  const invoiceItems = data?.items || [];

  if (!invoice) {
    return (
      <EmptyState
        icon={<FileText className="h-5 w-5" />}
        title="No invoice submitted"
        description="The vendor has not uploaded an invoice yet."
      />
    );
  }

  const estimateTotal = estimateItems.reduce((s, i) => s + i.amount, 0);
  const invoiceTotal = invoiceItems.reduce((s, i) => s + i.amount, 0);
  const diff = invoiceTotal - estimateTotal;
  const diffPct = estimateTotal > 0 ? (diff / estimateTotal) * 100 : 0;

  const isProducerApproved = !!invoice.producerApprovedAt;
  const isHopApproved = !!invoice.hopApprovedAt;
  const invoiceDocumentUrl = invoiceHref(invoice, campaignVendorId);

  async function handleSendBack() {
    if (!reason.trim()) return;
    setApproving(true);
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
      toast("success", "Invoice sent back to vendor");
      onStatusChange();
    } catch {
      toast("error", "Failed to send back invoice");
    } finally {
      setApproving(false);
      setSendingBack(false);
      setReason("");
    }
  }

  async function handleApprove(type: "producer" | "hop") {
    setApproving(true);
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
      mutate();
      onStatusChange();
    } catch {
      toast("error", "Failed to approve invoice");
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Invoice header + approve action */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-text-tertiary" />
          <a
            href={invoiceDocumentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
          >
            {invoice.fileName}
            <ExternalLink className="h-3 w-3" />
          </a>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
          >
            Preview
            <Eye className="h-3 w-3" />
          </button>
        </div>

        {/* Approval actions — right side of header */}
        <div className="flex items-center gap-2 shrink-0">
          {isProducerApproved && (
            <div className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approved
            </div>
          )}
          {isHopApproved && (
            <div className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approved
            </div>
          )}
          {!isProducerApproved && !sendingBack && (user?.role === "Producer" || user?.role === "Admin") && (
            <>
              <button
                onClick={() => setSendingBack(true)}
                disabled={approving}
                className="text-xs text-text-tertiary hover:text-destructive font-medium disabled:opacity-50"
              >
                Send Back
              </button>
              <Button
                size="sm"
                variant="secondary"
                loading={approving}
                onClick={() => handleApprove("producer")}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </Button>
            </>
          )}
          {isProducerApproved && !isHopApproved && user?.role === "Admin" && (
            <Button
              size="sm"
              loading={approving}
              onClick={() => handleApprove("hop")}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve
            </Button>
          )}
        </div>
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
              disabled={!reason.trim() || approving}
              loading={approving}
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

      {/* Flags */}
      {invoice.autoFlags && invoice.autoFlags.length > 0 && (
        <div className="space-y-1.5">
          {invoice.autoFlags.map((flag, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg bg-surface-secondary p-2.5"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="custom" className={SEVERITY_BADGE[flag.severity]}>
                    {flag.severity}
                  </Badge>
                  <span className="text-xs font-medium text-text-primary">
                    {flag.type}
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  {flag.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comparison table */}
      {invoiceItems.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-tertiary">
                <th className="text-left py-2 font-medium">Category</th>
                <th className="text-left py-2 font-medium">Description</th>
                <th className="text-right py-2 font-medium">Invoice</th>
                <th className="text-right py-2 font-medium">Estimate</th>
                <th className="text-right py-2 font-medium">Diff</th>
              </tr>
            </thead>
            <tbody>
              {invoiceItems.map((item) => {
                const matched = item.matchedEstimateItemId
                  ? estimateItems.find((e) => e.id === item.matchedEstimateItemId)
                  : null;
                const itemDiff = matched ? item.amount - matched.amount : item.amount;
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-border-light ${
                      item.flagged ? "bg-red-50/50" : ""
                    }`}
                  >
                    <td className="py-2 text-text-secondary">{item.category}</td>
                    <td className="py-2 text-text-primary">
                      {item.description}
                      {item.flagged && (
                        <span className="ml-1 text-red-600">⚑</span>
                      )}
                    </td>
                    <td className="py-2 text-right font-medium text-text-primary">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="py-2 text-right text-text-secondary">
                      {matched ? formatCurrency(matched.amount) : "—"}
                    </td>
                    <td
                      className={`py-2 text-right font-medium ${
                        itemDiff > 0
                          ? "text-red-600"
                          : itemDiff < 0
                          ? "text-emerald-600"
                          : "text-text-tertiary"
                      }`}
                    >
                      {itemDiff > 0 ? "+" : ""}
                      {formatCurrency(itemDiff)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-medium">
                <td colSpan={2} className="py-2 text-text-primary">
                  Total
                </td>
                <td className="py-2 text-right text-text-primary">
                  {formatCurrency(invoiceTotal)}
                </td>
                <td className="py-2 text-right text-text-secondary">
                  {formatCurrency(estimateTotal)}
                </td>
                <td
                  className={`py-2 text-right ${
                    diff > 0
                      ? "text-red-600"
                      : diff < 0
                      ? "text-emerald-600"
                      : "text-text-tertiary"
                  }`}
                >
                  {diff > 0 ? "+" : ""}
                  {formatCurrency(diff)}
                  {diffPct !== 0 && (
                    <span className="text-text-tertiary ml-1">
                      ({diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}%)
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <PdfPreviewModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        url={invoiceDocumentUrl}
        fileName={invoice.fileName}
        onRefresh={mutate}
      />

    </div>
  );
}
