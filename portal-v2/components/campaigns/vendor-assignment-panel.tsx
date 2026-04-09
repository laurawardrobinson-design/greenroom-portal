"use client";

import { useState, forwardRef, useImperativeHandle } from "react";
import useSWR from "swr";
import type { CampaignVendor, Vendor } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { VendorStatusTimeline } from "@/components/vendors/vendor-status-timeline";
import { EstimateForm } from "@/components/vendors/estimate-form";
import { PoSignature } from "@/components/vendors/po-signature";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatCurrency } from "@/lib/utils/format";
import { VENDOR_STATUS_COLORS } from "@/lib/constants/statuses";
import { InvoiceReviewPanel } from "@/components/campaigns/invoice-review-panel";
import { EstimateReviewPanel } from "@/components/campaigns/estimate-review-panel";
import { Plus, Users, Trash2, Upload, FileSearch, FileText, PenLine, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import type { VendorInvoice } from "@/types/domain";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Read-only invoice status shown to vendors after they've submitted */
function VendorInvoiceView({ campaignVendorId }: { campaignVendorId: string }) {
  const { data } = useSWR<{ invoice: VendorInvoice | null }>(
    `/api/invoices?campaignVendorId=${campaignVendorId}`,
    fetcher
  );
  const invoice = data?.invoice;
  if (!invoice) return null;

  const isProducerApproved = !!invoice.producerApprovedAt;
  const isHopApproved = !!invoice.hopApprovedAt;

  const statusLabel = isHopApproved
    ? "Fully approved"
    : isProducerApproved
    ? "Producer approved — awaiting HOP"
    : "Under review";

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-2">
      <div className="flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
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
      <p className="text-xs text-text-tertiary">{statusLabel}</p>
    </div>
  );
}

interface Props {
  campaignId: string;
  canEdit?: boolean;
}

export interface VendorAssignmentPanelHandle {
  openAssign: () => void;
}

export const VendorAssignmentPanel = forwardRef<VendorAssignmentPanelHandle, Props>(
  function VendorAssignmentPanel({ campaignId, canEdit }, ref) {
    const { user } = useCurrentUser();
    const { toast } = useToast();
    const [showAssign, setShowAssign] = useState(false);
    const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
    const [expandedEstimate, setExpandedEstimate] = useState<string | null>(null);
    const [uploadingInvoice, setUploadingInvoice] = useState<string | null>(null);
    const [showEstimateForm, setShowEstimateForm] = useState<string | null>(null);
    const [showPoSignature, setShowPoSignature] = useState<string | null>(null);
    const [uploadingPo, setUploadingPo] = useState<string | null>(null);
    const [invoiceConfirmation, setInvoiceConfirmation] = useState<{ fileName: string; fileSize: number } | null>(null);

    useImperativeHandle(ref, () => ({
      openAssign: () => setShowAssign(true),
    }));

    const { data: rawData, mutate } = useSWR<CampaignVendor[]>(
      `/api/campaign-vendors?campaignId=${campaignId}`,
      fetcher
    );
    const campaignVendors = Array.isArray(rawData) ? rawData : [];

    const isVendor = user?.role === "Vendor";

    // For vendors, filter to only their own assignment
    const visibleVendors = isVendor
      ? campaignVendors.filter((cv) => cv.vendorId === user?.vendorId)
      : campaignVendors;

    async function handleTransition(
      cvId: string,
      targetStatus: string,
      payload?: Record<string, unknown>
    ) {
      try {
        const res = await fetch(`/api/campaign-vendors/${cvId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "transition", targetStatus, payload }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error);
        }
        toast("success", `Status updated to ${targetStatus}`);
        mutate();
      } catch (err) {
        toast("error", err instanceof Error ? err.message : "Failed to update");
      }
    }

    async function handlePoUpload(cvId: string, file: File) {
      setUploadingPo(cvId);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("campaignId", campaignId);
        formData.append("category", "Contract");

        const uploadRes = await fetch("/api/files", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("Upload failed");
        const uploadData = await uploadRes.json();

        await handleTransition(cvId, "PO Uploaded", {
          poFileUrl: uploadData.url,
        });
      } catch {
        toast("error", "Failed to upload PO document");
      } finally {
        setUploadingPo(null);
      }
    }

    async function handleInvoiceUpload(cvId: string, file: File) {
      setUploadingInvoice(cvId);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("campaignVendorId", cvId);
        const res = await fetch("/api/invoices", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        toast("success", "Invoice uploaded");
        setInvoiceConfirmation({ fileName: file.name, fileSize: file.size });
        mutate();
      } catch {
        toast("error", "Failed to upload invoice");
      } finally {
        setUploadingInvoice(null);
      }
    }

    async function handleRemove(cvId: string) {
      try {
        await fetch(`/api/campaign-vendors/${cvId}`, { method: "DELETE" });
        toast("success", "Vendor removed");
        mutate();
      } catch {
        toast("error", "Failed to remove vendor");
      }
    }

    function triggerFileInput(accept: string, onFile: (file: File) => void) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) onFile(file);
      };
      input.click();
    }

    return (
      <>
        {visibleVendors.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-4 px-5">
            {canEdit && !isVendor ? (
              <button type="button" onClick={() => setShowAssign(true)}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-3 py-1.5 text-xs font-medium text-primary hover:border-primary hover:bg-primary/5 transition-colors">
                <Plus className="h-3 w-3" />
                Assign Vendor
              </button>
            ) : (
              <p className="text-sm text-text-tertiary text-center">
                {isVendor ? "You haven't been assigned to this campaign yet." : "No vendors assigned."}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3 max-h-[480px] overflow-y-auto">
            {visibleVendors.map((cv) => (
              <div
                key={cv.id}
                className="rounded-lg border border-border bg-surface-secondary p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary">
                      {cv.vendor?.companyName || "Unknown Vendor"}
                    </h4>
                    {cv.vendor?.contactName && (
                      <p className="text-xs text-text-tertiary">
                        {cv.vendor.contactName}
                        {cv.vendor.category && ` — ${cv.vendor.category}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="custom"
                      className={VENDOR_STATUS_COLORS[cv.status]}
                    >
                      {cv.status}
                    </Badge>
                    {!isVendor && !["Shoot Complete", "Invoice Submitted", "Invoice Pre-Approved", "Invoice Approved", "Paid"].includes(cv.status) && (
                      <button
                        onClick={() => {
                          if (cv.status !== "Invited") {
                            if (!confirm(`Remove ${cv.vendor?.companyName}? This will discard their estimate and PO data.`)) return;
                          }
                          handleRemove(cv.id);
                        }}
                        className="text-text-tertiary hover:text-error transition-colors"
                        title="Remove vendor"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Status timeline */}
                <VendorStatusTimeline currentStatus={cv.status} />

                {/* Financial summary */}
                {cv.estimateTotal > 0 && (
                  <div className="mt-3 flex gap-4 text-xs">
                    <span className="text-text-tertiary">
                      Estimate:{" "}
                      <span className="font-medium text-text-primary">
                        {formatCurrency(cv.estimateTotal)}
                      </span>
                    </span>
                    {cv.paymentAmount > 0 && (
                      <span className="text-text-tertiary">
                        Paid:{" "}
                        <span className="font-medium text-emerald-600">
                          {formatCurrency(cv.paymentAmount)}
                        </span>
                      </span>
                    )}
                  </div>
                )}

                {/* ===== VENDOR actions ===== */}
                {isVendor && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cv.status === "Invited" && (
                      <Button
                        size="sm"
                        onClick={() => setShowEstimateForm(cv.id)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Submit Estimate
                      </Button>
                    )}
                    {cv.status === "PO Uploaded" && (
                      <Button
                        size="sm"
                        onClick={() => setShowPoSignature(cv.id)}
                      >
                        <PenLine className="h-3.5 w-3.5" />
                        Sign PO
                      </Button>
                    )}
                    {cv.status === "Shoot Complete" && (
                      <Button
                        size="sm"
                        loading={uploadingInvoice === cv.id}
                        onClick={() =>
                          triggerFileInput(".pdf,.png,.jpg,.jpeg", (file) =>
                            handleInvoiceUpload(cv.id, file)
                          )
                        }
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload Invoice
                      </Button>
                    )}
                  </div>
                )}

                {/* Vendor: read-only invoice view after submission */}
                {isVendor && ["Invoice Submitted", "Invoice Pre-Approved", "Invoice Approved", "Paid"].includes(cv.status) && (
                  <VendorInvoiceView campaignVendorId={cv.id} />
                )}

                {/* ===== PRODUCER/ADMIN actions ===== */}
                {!isVendor && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cv.status === "Estimate Submitted" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setExpandedEstimate(
                            expandedEstimate === cv.id ? null : cv.id
                          )
                        }
                      >
                        <FileSearch className="h-3.5 w-3.5" />
                        {expandedEstimate === cv.id ? "Hide Estimate" : "Review Estimate"}
                      </Button>
                    )}
                    {cv.status === "Estimate Approved" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={uploadingPo === cv.id}
                        onClick={() =>
                          triggerFileInput(
                            ".pdf,.doc,.docx",
                            (file) => handlePoUpload(cv.id, file)
                          )
                        }
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload PO
                      </Button>
                    )}
                    {cv.status === "PO Signed" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          handleTransition(cv.id, "Shoot Complete")
                        }
                      >
                        Mark Shoot Complete
                      </Button>
                    )}
                    {cv.status === "Shoot Complete" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={uploadingInvoice === cv.id}
                        onClick={() =>
                          triggerFileInput(".pdf,.png,.jpg,.jpeg", (file) =>
                            handleInvoiceUpload(cv.id, file)
                          )
                        }
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload Invoice
                      </Button>
                    )}
                    {["Invoice Submitted", "Invoice Pre-Approved", "Invoice Approved", "Paid"].includes(cv.status) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setExpandedInvoice(
                            expandedInvoice === cv.id ? null : cv.id
                          )
                        }
                      >
                        <FileSearch className="h-3.5 w-3.5" />
                        {["Invoice Approved", "Paid"].includes(cv.status) ? "View Invoice" : "Review Invoice"}
                      </Button>
                    )}
                  </div>
                )}

                {/* Estimate form (expanded inline) */}
                {showEstimateForm === cv.id && (
                  <div className="mt-4 border-t border-border pt-4">
                    <EstimateForm
                      campaignVendorId={cv.id}
                      campaignId={campaignId}
                      onSubmitted={() => {
                        setShowEstimateForm(null);
                        mutate();
                      }}
                      onCancel={() => setShowEstimateForm(null)}
                    />
                  </div>
                )}

                {/* Estimate review panel (expanded) */}
                {expandedEstimate === cv.id && (
                  <EstimateReviewPanel
                    campaignVendorId={cv.id}
                    status={cv.status}
                    onStatusChange={() => mutate()}
                  />
                )}

                {/* PO Signature (expanded inline) */}
                {showPoSignature === cv.id && (
                  <div className="mt-4 border-t border-border pt-4 space-y-4">
                    {/* PO document preview above signature */}
                    {cv.poFileUrl && (
                      <div className="border border-border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-surface-secondary border-b border-border">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-text-tertiary" />
                            <span className="text-xs font-medium text-text-primary">Purchase Order</span>
                          </div>
                          <a
                            href={cv.poFileUrl.startsWith("/") && typeof window !== "undefined"
                              ? `${window.location.origin}${cv.poFileUrl}`
                              : cv.poFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-text-tertiary hover:text-primary transition-colors"
                          >
                            Open in new tab ↗
                          </a>
                        </div>
                        <iframe
                          src={cv.poFileUrl.startsWith("/") && typeof window !== "undefined"
                            ? `${window.location.origin}${cv.poFileUrl}`
                            : cv.poFileUrl}
                          title="Purchase Order"
                          className="w-full border-0"
                          style={{ height: "400px" }}
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

                {/* Invoice review panel (expanded) */}
                {expandedInvoice === cv.id && (
                  <InvoiceReviewPanel
                    campaignVendorId={cv.id}
                    onStatusChange={() => mutate()}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Assign vendor modal */}
        <AssignVendorModal
          open={showAssign}
          onClose={() => setShowAssign(false)}
          campaignId={campaignId}
          onAssigned={() => {
            mutate();
            setShowAssign(false);
          }}
          existingVendorIds={campaignVendors.map((cv) => cv.vendorId)}
        />

        {/* Invoice upload confirmation */}
        <Modal
          open={!!invoiceConfirmation}
          onClose={() => setInvoiceConfirmation(null)}
          title="Invoice Uploaded"
          size="sm"
        >
          {invoiceConfirmation && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-emerald-900 truncate">{invoiceConfirmation.fileName}</p>
                  <p className="text-xs text-emerald-700">
                    {(invoiceConfirmation.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-text-primary">What happens next</h3>
                <ul className="space-y-2 text-sm text-text-secondary">
                  <li className="flex items-start gap-2">
                    <FileSearch className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
                    <span>The Producer will review your uploaded invoice document</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Users className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
                    <span>The Producer will review and compare against your estimate</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
                    <span>Once approved by Producer and Finance, payment is processed</span>
                  </li>
                </ul>
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-xs text-text-tertiary flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Typical timeline: reviewed in 48h, payment 5–10 business days
                </p>
              </div>
            </div>
          )}
          <ModalFooter>
            <Button onClick={() => setInvoiceConfirmation(null)}>Got It</Button>
          </ModalFooter>
        </Modal>
      </>
    );
  }
);

function AssignVendorModal({
  open,
  onClose,
  campaignId,
  onAssigned,
  existingVendorIds,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  onAssigned: () => void;
  existingVendorIds: string[];
}) {
  const { toast } = useToast();
  const { data: allVendors = [] } = useSWR<Vendor[]>(
    open ? "/api/vendors" : null,
    fetcher
  );
  const [assigning, setAssigning] = useState<string | null>(null);

  const available = allVendors.filter(
    (v) => !existingVendorIds.includes(v.id)
  );

  async function handleAssign(vendorId: string) {
    setAssigning(vendorId);
    try {
      const res = await fetch("/api/campaign-vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, vendorId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast("success", "Vendor assigned");
      onAssigned();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to assign");
    } finally {
      setAssigning(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Assign Vendor" size="lg">
      {available.length === 0 ? (
        <EmptyState
          title="No available vendors"
          description={
            allVendors.length === 0
              ? "Add vendors to the roster first."
              : "All vendors are already assigned to this campaign."
          }
        />
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {available.map((vendor) => (
            <div
              key={vendor.id}
              className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-surface-secondary transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {vendor.companyName}
                </p>
                <p className="text-xs text-text-tertiary">
                  {vendor.contactName}
                  {vendor.category && ` — ${vendor.category}`}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                loading={assigning === vendor.id}
                disabled={assigning !== null}
                onClick={() => handleAssign(vendor.id)}
              >
                Assign
              </Button>
            </div>
          ))}
        </div>
      )}
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </ModalFooter>
    </Modal>
  );
}
