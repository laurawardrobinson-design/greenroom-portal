"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import type { Campaign, CampaignVendor, CampaignVendorStatus, VendorInvoice } from "@/types/domain";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstimateForm } from "@/components/vendors/estimate-form";
import { PoSignature } from "@/components/vendors/po-signature";
import { VendorStatusTimeline } from "@/components/vendors/vendor-status-timeline";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils/format";
import { VENDOR_STATUS_COLORS } from "@/lib/constants/statuses";
import { ExternalLink, FileText, Loader2, Upload } from "lucide-react";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Request failed");
  return res.json();
};

const WAITING_MESSAGE: Partial<Record<CampaignVendorStatus, string>> = {
  "Estimate Submitted": "Your estimate is waiting for producer review.",
  "Estimate Approved": "Your estimate is approved. Waiting for PO upload.",
  "PO Signed": "PO signed. Waiting for the shoot to be marked complete.",
  "Invoice Submitted": "Invoice submitted and under review.",
  "Invoice Pre-Approved": "Invoice pre-approved and waiting final approval.",
  "Invoice Approved": "Invoice fully approved. Payment is being processed.",
  Paid: "Payment complete.",
};

const PAYMENT_STEPS = [
  "Invoice Submitted",
  "Invoice Pre-Approved",
  "Invoice Approved",
  "Paid",
] as const;

const PAYMENT_STEP_BY_STATUS: Partial<Record<CampaignVendorStatus, number>> = {
  "Invoice Submitted": 1,
  "Invoice Pre-Approved": 2,
  "Invoice Approved": 3,
  Paid: 4,
};

function PaymentTracker({
  status,
  paymentAmount,
  paymentDate,
}: {
  status: CampaignVendorStatus;
  paymentAmount: number;
  paymentDate: string | null;
}) {
  const reached = PAYMENT_STEP_BY_STATUS[status] ?? 0;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1">
        {PAYMENT_STEPS.map((label, index) => {
          const isReached = reached > index;
          const isCurrent = reached === index + 1 && status !== "Paid";
          return (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <div
                className={`h-4 w-4 shrink-0 rounded-full transition-all ${
                  isReached
                    ? "bg-emerald-500"
                    : isCurrent
                    ? "bg-primary ring-2 ring-primary/25"
                    : "bg-surface-tertiary"
                }`}
                title={label}
              />
              {index < PAYMENT_STEPS.length - 1 && (
                <div
                  className={`mx-1 h-[2px] flex-1 ${
                    reached > index + 1 ? "bg-emerald-400" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-text-tertiary md:grid-cols-4">
        {PAYMENT_STEPS.map((label) => (
          <p key={label}>{label}</p>
        ))}
      </div>

      <p className="text-xs text-text-secondary">
        {status === "Paid"
          ? `Paid${paymentAmount > 0 ? ` ${formatCurrency(paymentAmount)}` : ""}${
              paymentDate ? ` on ${new Date(paymentDate).toLocaleDateString("en-US")}` : ""
            }.`
          : reached === 0
          ? "Payment tracking will start after invoice submission."
          : "Payment is in progress."}
      </p>
    </div>
  );
}

function InvoiceStatusView({ campaignVendorId }: { campaignVendorId: string }) {
  const { data, isLoading } = useSWR<{ invoice: VendorInvoice | null }>(
    `/api/invoices?campaignVendorId=${campaignVendorId}`,
    fetcher
  );

  if (isLoading) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading invoice status...
      </p>
    );
  }

  const invoice = data?.invoice;
  if (!invoice) {
    return <p className="text-xs text-text-tertiary">No invoice file uploaded yet.</p>;
  }

  const isProducerApproved = !!invoice.producerApprovedAt;
  const isHopApproved = !!invoice.hopApprovedAt;

  const statusText = isHopApproved
    ? "Fully approved"
    : isProducerApproved
    ? "Producer approved, waiting finance"
    : "Under review";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
        <a
          href={invoice.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <span className="truncate">{invoice.fileName}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      </div>
      <p className="text-xs text-text-tertiary">
        {statusText}
      </p>
    </div>
  );
}

export default function VendorWorkflowPage() {
  const { user, isLoading: loadingUser } = useCurrentUser();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const focusedAssignment = searchParams.get("assignment");

  const [showEstimateForm, setShowEstimateForm] = useState<string | null>(null);
  const [showPoSignature, setShowPoSignature] = useState<string | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState<string | null>(null);

  const { data: rawAssignments, isLoading: loadingAssignments, mutate } = useSWR<CampaignVendor[]>(
    user?.vendorId ? `/api/campaign-vendors?vendorId=${user.vendorId}` : null,
    fetcher
  );
  const { data: campaigns = [] } = useSWR<Campaign[]>(
    user ? "/api/campaigns" : null,
    fetcher
  );

  const assignments = useMemo(
    () => (Array.isArray(rawAssignments) ? rawAssignments : []),
    [rawAssignments]
  );
  const campaignById = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign])),
    [campaigns]
  );

  const sortedAssignments = useMemo(() => {
    return [...assignments].sort((a, b) => {
      if (focusedAssignment && a.id === focusedAssignment) return -1;
      if (focusedAssignment && b.id === focusedAssignment) return 1;
      if (a.status === "Paid" && b.status !== "Paid") return 1;
      if (b.status === "Paid" && a.status !== "Paid") return -1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [assignments, focusedAssignment]);

  function triggerFileInput(onFile: (file: File) => void) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.png,.jpg,.jpeg";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) onFile(file);
    };
    input.click();
  }

  async function handleInvoiceUpload(campaignVendorId: string, file: File) {
    setUploadingInvoice(campaignVendorId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("campaignVendorId", campaignVendorId);
      const res = await fetch("/api/invoices", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      toast("success", "Invoice uploaded");
      mutate();
    } catch {
      toast("error", "Failed to upload invoice");
    } finally {
      setUploadingInvoice(null);
    }
  }

  if (loadingUser || !user) return <DashboardSkeleton />;

  if (user.role !== "Vendor") {
    return (
      <EmptyState
        title="Vendor workflow only"
        description="This area is only available to vendor users."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-text-primary">Workflow</h1>
        <p className="text-sm text-text-secondary">
          Submit estimates, sign POs, and upload invoices here. Campaign pages are read-only for vendors.
        </p>
      </div>

      {loadingAssignments ? (
        <div className="space-y-3">
          <Card>
            <DashboardSkeleton />
          </Card>
          <Card>
            <DashboardSkeleton />
          </Card>
        </div>
      ) : sortedAssignments.length === 0 ? (
        <Card>
          <EmptyState
            title="No workflow assignments yet"
            description="When a producer assigns you to a campaign, your estimate, PO, and invoice workflow will appear here."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedAssignments.map((cv) => {
            const campaign = campaignById.get(cv.campaignId);
            const campaignLabel = campaign?.wfNumber
              ? `${campaign.wfNumber} ${campaign.name}`
              : campaign?.name || "Campaign";
            const waiting = WAITING_MESSAGE[cv.status];
            const isInvoiceStage = ["Invoice Submitted", "Invoice Pre-Approved", "Invoice Approved", "Paid"].includes(cv.status);
            const isFocused = focusedAssignment === cv.id;
            const poHref = cv.poFileUrl;

            return (
              <Card
                key={cv.id}
                className={isFocused ? "ring-1 ring-primary/30 shadow-sm" : ""}
              >
                <CardHeader className="mb-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate">{campaignLabel}</CardTitle>
                    <p className="mt-1 text-xs text-text-tertiary">Assignment workflow</p>
                  </div>
                  <Badge variant="custom" className={VENDOR_STATUS_COLORS[cv.status]}>
                    {cv.status}
                  </Badge>
                </CardHeader>

                <div className="space-y-4">
                  <VendorStatusTimeline currentStatus={cv.status} />

                  <div className="grid grid-cols-1 gap-2 text-xs text-text-secondary sm:grid-cols-3">
                    <p>
                      Estimate:{" "}
                      <span className="font-medium text-text-primary">
                        {formatCurrency(cv.estimateTotal || 0)}
                      </span>
                    </p>
                    <p>
                      Invoice:{" "}
                      <span className="font-medium text-text-primary">
                        {formatCurrency(cv.invoiceTotal || 0)}
                      </span>
                    </p>
                    <p>
                      Paid:{" "}
                      <span className="font-medium text-emerald-700">
                        {formatCurrency(cv.paymentAmount || 0)}
                      </span>
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-surface-secondary p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                      Payment Tracker
                    </p>
                    <PaymentTracker
                      status={cv.status}
                      paymentAmount={cv.paymentAmount}
                      paymentDate={cv.paymentDate}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {cv.status === "Invited" && (
                      <Button size="sm" onClick={() => setShowEstimateForm(cv.id)}>
                        Submit Estimate
                      </Button>
                    )}
                    {cv.status === "PO Uploaded" && (
                      <Button size="sm" onClick={() => setShowPoSignature(cv.id)}>
                        Sign PO
                      </Button>
                    )}
                    {cv.status === "Shoot Complete" && (
                      <Button
                        size="sm"
                        loading={uploadingInvoice === cv.id}
                        onClick={() =>
                          triggerFileInput((file) => handleInvoiceUpload(cv.id, file))
                        }
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload Invoice
                      </Button>
                    )}
                    <Link
                      href={`/campaigns/${cv.campaignId}`}
                      className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
                    >
                      Campaign (read-only)
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>

                  {waiting && cv.status !== "Invited" && cv.status !== "PO Uploaded" && cv.status !== "Shoot Complete" && (
                    <p className="text-xs text-text-tertiary">{waiting}</p>
                  )}

                  {isInvoiceStage && (
                    <div className="rounded-lg border border-border p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                        Invoice Status
                      </p>
                      <InvoiceStatusView campaignVendorId={cv.id} />
                    </div>
                  )}

                  {showEstimateForm === cv.id && (
                    <div className="border-t border-border pt-4">
                      <EstimateForm
                        campaignVendorId={cv.id}
                        campaignId={cv.campaignId}
                        onSubmitted={() => {
                          setShowEstimateForm(null);
                          mutate();
                        }}
                        onCancel={() => setShowEstimateForm(null)}
                      />
                    </div>
                  )}

                  {showPoSignature === cv.id && (
                    <div className="border-t border-border pt-4 space-y-4">
                      {poHref && (
                        <div className="rounded-lg border border-border overflow-hidden">
                          <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-secondary px-3 py-2">
                            <p className="text-xs font-medium text-text-primary">Purchase Order</p>
                            <a
                              href={poHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-text-tertiary hover:text-primary"
                            >
                              Open in new tab
                            </a>
                          </div>
                          <iframe
                            src={poHref}
                            title="Purchase Order"
                            className="w-full border-0"
                            style={{ height: "360px" }}
                          />
                        </div>
                      )}
                      <PoSignature
                        campaignVendorId={cv.id}
                        poFileUrl={cv.poFileUrl}
                        onSigned={() => {
                          setShowPoSignature(null);
                          mutate();
                        }}
                        onCancel={() => setShowPoSignature(null)}
                      />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
