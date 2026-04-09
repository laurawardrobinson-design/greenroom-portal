"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  Check,
  Clock,
  ExternalLink,
  FileText,
  PenLine,
  Upload,
  WalletCards,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { CampaignVendor, CampaignVendorStatus, VendorInvoice } from "@/types/domain";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { VendorStatusTimeline } from "@/components/vendors/vendor-status-timeline";
import { EstimateForm } from "@/components/vendors/estimate-form";
import { PoSignature } from "@/components/vendors/po-signature";
import { formatCurrency } from "@/lib/utils/format";
import { VENDOR_STATUS_COLORS } from "@/lib/constants/statuses";

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Request failed");
  }
  return res.json();
};

const PAYMENT_TRACKER_STAGES: Array<{
  status: CampaignVendorStatus;
  label: string;
}> = [
  { status: "Invoice Submitted", label: "Submitted" },
  { status: "Invoice Pre-Approved", label: "Producer" },
  { status: "Invoice Approved", label: "Finance" },
  { status: "Paid", label: "Paid" },
];

const ACTION_STATUSES = new Set<CampaignVendorStatus>([
  "Invited",
  "Estimate Revision Requested",
  "PO Uploaded",
  "Shoot Complete",
]);

type WorkflowGuidanceTone = "action" | "wait" | "done";

function getVendorWorkflowGuidance(
  status: CampaignVendorStatus
): { tone: WorkflowGuidanceTone; message: string } {
  switch (status) {
    case "Invited":
      return { tone: "action", message: "Action needed: submit estimate to start approvals." };
    case "Estimate Revision Requested":
      return { tone: "action", message: "Action needed: revise estimate based on producer feedback." };
    case "Estimate Submitted":
      return { tone: "wait", message: "Waiting on Producer: estimate review." };
    case "Estimate Approved":
      return { tone: "wait", message: "Waiting on Producer: upload PO and send for signature." };
    case "PO Uploaded":
      return { tone: "action", message: "Action needed: review and sign PO." };
    case "PO Signed":
      return { tone: "wait", message: "Waiting on Producer: mark shoot complete before invoice submission is enabled." };
    case "Shoot Complete":
      return { tone: "action", message: "Action needed: submit invoice." };
    case "Invoice Submitted":
      return { tone: "wait", message: "Waiting on Producer: invoice review and pre-approval." };
    case "Invoice Pre-Approved":
      return { tone: "wait", message: "Waiting on HOP: final invoice approval." };
    case "Invoice Approved":
      return { tone: "done", message: "Invoice approved. Finance handoff is in progress." };
    case "Paid":
      return { tone: "done", message: "Payment has been completed." };
    case "Rejected":
      return { tone: "wait", message: "This workflow was rejected. Coordinate next steps with Producer." };
    default:
      return { tone: "wait", message: "Waiting on workflow updates." };
  }
}

function workflowGuidanceStyle(tone: WorkflowGuidanceTone): string {
  if (tone === "action") return "border-amber-200 bg-amber-50 text-amber-800";
  if (tone === "done") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-blue-200 bg-blue-50 text-blue-800";
}

function getPoPreviewUrl(url: string): string {
  if (!url.startsWith("/")) return url;
  if (typeof window === "undefined") return url;
  return `${window.location.origin}${url}`;
}

function PaymentTracker({ status }: { status: CampaignVendorStatus }) {
  const currentIndex = PAYMENT_TRACKER_STAGES.findIndex(
    (stage) => stage.status === status
  );
  const hasStarted = currentIndex >= 0;
  const barWidth = hasStarted
    ? `${(currentIndex / (PAYMENT_TRACKER_STAGES.length - 1)) * 100}%`
    : "0%";

  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface-secondary/60 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
        Payment Tracker
      </p>
      <div className="relative">
        <div className="absolute left-0 right-0 top-2 h-px bg-border" />
        <div
          className="absolute left-0 top-2 h-px bg-emerald-300 transition-all"
          style={{ width: barWidth }}
        />
        <div className="relative grid grid-cols-4 gap-2">
          {PAYMENT_TRACKER_STAGES.map((stage, index) => {
            const complete = hasStarted && index < currentIndex;
            const current = hasStarted && index === currentIndex;
            return (
              <div key={stage.status} className="text-center">
                <div
                  className={`mx-auto flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${
                    complete
                      ? "bg-emerald-100 text-emerald-700"
                      : current
                        ? "bg-primary text-white ring-2 ring-primary/20"
                        : "bg-surface-tertiary text-text-tertiary"
                  }`}
                >
                  {complete ? <Check className="h-2.5 w-2.5" /> : index + 1}
                </div>
                <p
                  className={`mt-1 text-[10px] font-medium ${
                    complete || current ? "text-text-primary" : "text-text-tertiary"
                  }`}
                >
                  {stage.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>
      {!hasStarted && (
        <p className="text-xs text-text-tertiary">
          Payment tracking starts after invoice submission.
        </p>
      )}
    </div>
  );
}

function InvoiceStatusView({ campaignVendorId }: { campaignVendorId: string }) {
  const { data } = useSWR<{ invoice: VendorInvoice | null }>(
    `/api/invoices?campaignVendorId=${campaignVendorId}`,
    fetcher
  );

  const invoice = data?.invoice;
  if (!invoice) return null;

  const parsing =
    invoice.parseStatus === "pending" || invoice.parseStatus === "processing";
  const producerApproved = !!invoice.producerApprovedAt;
  const finalApproved = !!invoice.hopApprovedAt;

  const statusLabel = finalApproved
    ? "Final approval complete"
    : producerApproved
      ? "Producer approved, awaiting final approval"
      : "Awaiting producer review";

  return (
    <div className="rounded-lg border border-border bg-surface-secondary/60 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            Invoice File
          </p>
          <a
            href={invoice.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {invoice.fileName}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {parsing ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-700">
            <Clock className="h-3 w-3" />
            Parsing
          </span>
        ) : (
          <span className="text-xs text-emerald-700">Parsed</span>
        )}
      </div>
      <p className="mt-1 text-xs text-text-secondary">{statusLabel}</p>
    </div>
  );
}

export default function VendorWorkflowPage() {
  const { user, isLoading: loadingUser } = useCurrentUser();
  const searchParams = useSearchParams();
  const focusAssignmentId = searchParams.get("assignment");
  const { toast } = useToast();

  const [showEstimateForm, setShowEstimateForm] = useState<string | null>(null);
  const [showPoSignature, setShowPoSignature] = useState<string | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState<string | null>(null);
  const [invoiceConfirmation, setInvoiceConfirmation] = useState<{
    fileName: string;
    fileSize: number;
  } | null>(null);

  const { data: assignmentsData, isLoading, mutate } = useSWR<CampaignVendor[]>(
    user?.vendorId ? `/api/campaign-vendors?vendorId=${user.vendorId}` : null,
    fetcher
  );

  const assignments = useMemo(
    () => (Array.isArray(assignmentsData) ? assignmentsData : []),
    [assignmentsData]
  );

  const sortedAssignments = useMemo(() => {
    const sorted = [...assignments].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    if (!focusAssignmentId) return sorted;
    const focusIndex = sorted.findIndex((item) => item.id === focusAssignmentId);
    if (focusIndex <= 0) return sorted;
    const [focus] = sorted.splice(focusIndex, 1);
    sorted.unshift(focus);
    return sorted;
  }, [assignments, focusAssignmentId]);

  const activeAssignments = sortedAssignments.filter(
    (item) => item.status !== "Paid" && item.status !== "Rejected"
  );
  const paidAssignments = sortedAssignments.filter((item) => item.status === "Paid");
  const actionNeededCount = sortedAssignments.filter((item) =>
    ACTION_STATUSES.has(item.status)
  ).length;

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
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Invoice upload failed");
      }
      setInvoiceConfirmation({ fileName: file.name, fileSize: file.size });
      toast("success", "Invoice uploaded");
      mutate();
    } catch (error) {
      toast(
        "error",
        error instanceof Error ? error.message : "Invoice upload failed"
      );
    } finally {
      setUploadingInvoice(null);
    }
  }

  if (loadingUser || isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Vendor Workflow" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <div className="h-44 animate-pulse rounded-lg bg-surface-secondary" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!user || user.role !== "Vendor") {
    return (
      <EmptyState
        icon={<WalletCards className="h-5 w-5" />}
        title="Vendor workflow is only available to vendor users"
        description="Switch to a vendor account to access estimate, PO, and invoice actions."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor Workflow"
        actions={
          <div className="rounded-lg border border-border bg-surface-secondary px-3 py-1.5 text-xs text-text-tertiary">
            Actions needed: {actionNeededCount}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
            Active Assignments
          </p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">
            {activeAssignments.length}
          </p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
            Action Needed
          </p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">
            {actionNeededCount}
          </p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
            Paid Campaigns
          </p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">
            {paidAssignments.length}
          </p>
        </Card>
      </div>

      {sortedAssignments.length === 0 ? (
        <EmptyState
          icon={<WalletCards className="h-5 w-5" />}
          title="No assignments yet"
          description="When you are assigned to a campaign, its estimate/PO/invoice workflow will appear here."
        />
      ) : (
        <div className="space-y-4">
          {sortedAssignments.map((assignment) => (
            <Card
              key={assignment.id}
              className={focusAssignmentId === assignment.id ? "ring-1 ring-primary/30" : ""}
            >
              <CardHeader className="mb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                    {assignment.campaignWfNumber || "WF —"}
                  </p>
                  <CardTitle className="text-sm">
                    {assignment.campaignName || "Campaign"}
                  </CardTitle>
                  <p className="text-xs text-text-secondary">
                    {assignment.vendor?.companyName || "Vendor"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/campaigns/${assignment.campaignId}`}
                    className="inline-flex h-8 items-center rounded-md border border-border px-2 text-xs font-medium text-text-secondary transition-colors hover:border-primary hover:text-primary"
                  >
                    Campaign (Read-Only)
                  </Link>
                  <Badge
                    variant="custom"
                    className={
                      VENDOR_STATUS_COLORS[assignment.status] || "bg-slate-100 text-slate-700"
                    }
                  >
                    {assignment.status}
                  </Badge>
                </div>
              </CardHeader>

              <div className="space-y-3">
                <VendorStatusTimeline
                  currentStatus={assignment.status}
                  estimateFeedback={assignment.estimateFeedback}
                />

                {(() => {
                  const guidance = getVendorWorkflowGuidance(assignment.status);
                  return (
                    <div
                      className={`rounded-md border px-3 py-2 text-xs ${workflowGuidanceStyle(
                        guidance.tone
                      )}`}
                    >
                      <span className="font-semibold uppercase tracking-wide">Next Step:</span>{" "}
                      {guidance.message}
                    </div>
                  );
                })()}

                <PaymentTracker status={assignment.status} />

                {(assignment.estimateTotal > 0 ||
                  assignment.invoiceTotal > 0 ||
                  assignment.paymentAmount > 0) && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-md border border-border bg-surface-secondary px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-text-tertiary">
                        Estimate
                      </p>
                      <p className="text-sm font-semibold text-text-primary">
                        {assignment.estimateTotal > 0
                          ? formatCurrency(assignment.estimateTotal)
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-md border border-border bg-surface-secondary px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-text-tertiary">
                        Invoice
                      </p>
                      <p className="text-sm font-semibold text-text-primary">
                        {assignment.invoiceTotal > 0
                          ? formatCurrency(assignment.invoiceTotal)
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-md border border-border bg-surface-secondary px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-text-tertiary">
                        Paid
                      </p>
                      <p className="text-sm font-semibold text-emerald-700">
                        {assignment.paymentAmount > 0
                          ? formatCurrency(assignment.paymentAmount)
                          : "—"}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {(assignment.status === "Invited" ||
                    assignment.status === "Estimate Revision Requested") && (
                    <Button
                      size="sm"
                      onClick={() => setShowEstimateForm(assignment.id)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {assignment.status === "Estimate Revision Requested"
                        ? "Revise Estimate"
                        : "Submit Estimate"}
                    </Button>
                  )}

                  {assignment.status === "PO Uploaded" && (
                    <Button
                      size="sm"
                      onClick={() => setShowPoSignature(assignment.id)}
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      Review & Sign PO
                    </Button>
                  )}

                  {assignment.status === "Shoot Complete" && (
                    <Button
                      size="sm"
                      loading={uploadingInvoice === assignment.id}
                      onClick={() =>
                        triggerFileInput((file) =>
                          handleInvoiceUpload(assignment.id, file)
                        )
                      }
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Submit Invoice
                    </Button>
                  )}
                </div>

                {[
                  "Invoice Submitted",
                  "Invoice Pre-Approved",
                  "Invoice Approved",
                  "Paid",
                ].includes(assignment.status) && (
                  <InvoiceStatusView campaignVendorId={assignment.id} />
                )}

                {showEstimateForm === assignment.id && (
                  <div className="rounded-lg border border-border bg-surface px-3 py-3">
                    <EstimateForm
                      campaignVendorId={assignment.id}
                      campaignId={assignment.campaignId}
                      onSubmitted={() => {
                        setShowEstimateForm(null);
                        mutate();
                      }}
                      onCancel={() => setShowEstimateForm(null)}
                    />
                  </div>
                )}

                {showPoSignature === assignment.id && (
                  <div className="space-y-3 rounded-lg border border-border bg-surface px-3 py-3">
                    {assignment.poFileUrl && (
                      <div className="overflow-hidden rounded-lg border border-border">
                        <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-secondary px-3 py-2">
                          <p className="text-xs font-medium text-text-primary">
                            Purchase Order
                          </p>
                          <a
                            href={getPoPreviewUrl(assignment.poFileUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-primary"
                          >
                            Open
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        <iframe
                          src={getPoPreviewUrl(assignment.poFileUrl)}
                          title="Purchase Order"
                          className="h-[420px] w-full border-0"
                        />
                      </div>
                    )}

                    <PoSignature
                      campaignVendorId={assignment.id}
                      poFileUrl={assignment.poFileUrl}
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
          ))}
        </div>
      )}

      <Modal
        open={!!invoiceConfirmation}
        onClose={() => setInvoiceConfirmation(null)}
        title="Invoice Submitted"
        size="sm"
      >
        {invoiceConfirmation && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              <span className="font-medium text-text-primary">
                {invoiceConfirmation.fileName}
              </span>{" "}
              was uploaded successfully.
            </p>
            <p className="text-xs text-text-tertiary">
              File size: {(invoiceConfirmation.fileSize / 1024 / 1024).toFixed(2)} MB
            </p>
            <p className="text-xs text-text-tertiary">
              Next: Producer review, then final finance approval.
            </p>
          </div>
        )}
        <ModalFooter>
          <Button onClick={() => setInvoiceConfirmation(null)}>Got It</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
