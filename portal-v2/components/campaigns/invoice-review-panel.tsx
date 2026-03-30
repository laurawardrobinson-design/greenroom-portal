"use client";

import { useState } from "react";
import useSWR from "swr";
import type { VendorInvoice, VendorInvoiceItem, VendorEstimateItem } from "@/types/domain";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatCurrency } from "@/lib/utils/format";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SEVERITY_BADGE: Record<string, string> = {
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-blue-50 text-blue-700",
};

interface Props {
  campaignVendorId: string;
  estimateItems: VendorEstimateItem[];
  onStatusChange: () => void;
}

export function InvoiceReviewPanel({
  campaignVendorId,
  estimateItems,
  onStatusChange,
}: Props) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [approving, setApproving] = useState(false);

  const { data, mutate } = useSWR<{
    invoice: VendorInvoice | null;
    items: VendorInvoiceItem[];
  }>(`/api/invoices?campaignVendorId=${campaignVendorId}`, fetcher);

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

  const isParsing = invoice.parseStatus === "pending" || invoice.parseStatus === "processing";
  const hasFailed = invoice.parseStatus === "failed";
  const isProducerApproved = !!invoice.producerApprovedAt;
  const isHopApproved = !!invoice.hopApprovedAt;

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
      toast("success", type === "producer" ? "Invoice pre-approved" : "Invoice approved");
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
      {/* Invoice header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-text-tertiary" />
          <a
            href={invoice.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
          >
            {invoice.fileName}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {isParsing && (
          <Badge variant="custom" className="bg-amber-50 text-amber-700">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            Parsing...
          </Badge>
        )}
        {hasFailed && (
          <Badge variant="custom" className="bg-red-50 text-red-700">
            Parse failed
          </Badge>
        )}
      </div>

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

      {/* Approval actions */}
      <div className="flex items-center gap-3 pt-2">
        {isProducerApproved && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Producer pre-approved
          </div>
        )}
        {isHopApproved && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            HOP approved
          </div>
        )}

        {/* Producer pre-approve */}
        {!isProducerApproved && user?.role === "Producer" && (
          <Button
            size="sm"
            variant="secondary"
            loading={approving}
            onClick={() => handleApprove("producer")}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Pre-Approve Invoice
          </Button>
        )}

        {/* HOP final approve (only after producer pre-approved) */}
        {isProducerApproved && !isHopApproved && user?.role === "Admin" && (
          <Button
            size="sm"
            loading={approving}
            onClick={() => handleApprove("hop")}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Approve Invoice
          </Button>
        )}
      </div>
    </div>
  );
}
