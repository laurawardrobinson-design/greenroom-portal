"use client";

import { useState, forwardRef, useImperativeHandle } from "react";
import useSWR from "swr";
import type { CampaignVendor, CampaignVendorStatus, Vendor } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatCurrency } from "@/lib/utils/format";
import { VendorLifecycleModal } from "@/components/campaigns/vendor-lifecycle-modal";
import { Plus, Trash2, Settings2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Phase chip helpers ───────────────────────────────────────────────────────

type Phase = "estimate" | "po" | "invoice" | "complete";

function getPhase(status: CampaignVendorStatus): Phase {
  if (["Invited", "Estimate Submitted", "Estimate Approved", "Rejected"].includes(status)) return "estimate";
  if (["PO Uploaded", "PO Signed", "Shoot Complete"].includes(status)) return "po";
  if (["Invoice Submitted", "Invoice Pre-Approved", "Invoice Approved"].includes(status)) return "invoice";
  return "complete"; // Paid
}

const PHASE_LABEL: Record<Phase, string> = {
  estimate: "Estimate",
  po: "PO",
  invoice: "Invoice",
  complete: "Complete",
};

const PHASE_STYLE: Record<Phase, string> = {
  estimate: "bg-amber-50 text-amber-700 border-amber-200",
  po: "bg-blue-50 text-blue-700 border-blue-200",
  invoice: "bg-violet-50 text-violet-700 border-violet-200",
  complete: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function getSubLabel(status: CampaignVendorStatus): string {
  switch (status) {
    case "Invited":            return "Awaiting submission";
    case "Estimate Submitted": return "Submitted — review needed";
    case "Estimate Approved":  return "Approved — upload PO";
    case "Rejected":           return "Sent back";
    case "PO Uploaded":        return "Awaiting signature";
    case "PO Signed":          return "Signed — shoot pending";
    case "Shoot Complete":     return "Submit invoice";
    case "Invoice Submitted":  return "Submitted — review needed";
    case "Invoice Pre-Approved": return "Pre-approved — final review";
    case "Invoice Approved":   return "Approved";
    case "Paid":               return "Paid";
    default:                   return status;
  }
}

function needsProducerAction(status: CampaignVendorStatus, isHop: boolean): boolean {
  if (isHop && status === "Invoice Pre-Approved") return true;
  return ["Estimate Submitted", "Estimate Approved", "Invoice Submitted"].includes(status);
}

function needsVendorAction(status: CampaignVendorStatus): boolean {
  return ["Invited", "PO Uploaded", "Shoot Complete", "Rejected"].includes(status);
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  campaignId: string;
  wfNumber?: string;
  canEdit?: boolean;
}

export interface VendorAssignmentPanelHandle {
  openAssign: () => void;
}

export const VendorAssignmentPanel = forwardRef<VendorAssignmentPanelHandle, Props>(
  function VendorAssignmentPanel({ campaignId, wfNumber = "", canEdit }, ref) {
    const { user } = useCurrentUser();
    const { toast } = useToast();
    const [showAssign, setShowAssign] = useState(false);
    const [managingVendor, setManagingVendor] = useState<CampaignVendor | null>(null);

    useImperativeHandle(ref, () => ({
      openAssign: () => setShowAssign(true),
    }));

    const { data: rawData, mutate } = useSWR<CampaignVendor[]>(
      `/api/campaign-vendors?campaignId=${campaignId}`,
      fetcher
    );
    const campaignVendors = Array.isArray(rawData) ? rawData : [];

    const isVendor = user?.role === "Vendor";
    const isHop = user?.role === "Admin";

    // For vendors, filter to only their own assignment
    const visibleVendors = isVendor
      ? campaignVendors.filter((cv) => cv.vendorId === user?.vendorId)
      : campaignVendors;

    async function handleRemove(cvId: string) {
      try {
        await fetch(`/api/campaign-vendors/${cvId}`, { method: "DELETE" });
        toast("success", "Vendor removed");
        mutate();
      } catch {
        toast("error", "Failed to remove vendor");
      }
    }

    // Keep managingVendor in sync when the SWR data refreshes
    function handleStatusChange() {
      mutate().then((updatedVendors) => {
        if (managingVendor && Array.isArray(updatedVendors)) {
          const updated = updatedVendors.find((cv) => cv.id === managingVendor.id);
          if (updated) setManagingVendor(updated);
        }
      });
    }

    return (
      <>
        {visibleVendors.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-4 px-5">
            {canEdit && !isVendor ? (
              <button
                type="button"
                onClick={() => setShowAssign(true)}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-3 py-1.5 text-xs font-medium text-primary hover:border-primary hover:bg-primary/5 transition-colors"
              >
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
          <div className="space-y-2">
            {canEdit && !isVendor && (
              <div className="flex justify-end mb-1">
                <button
                  type="button"
                  onClick={() => setShowAssign(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" />
                  Assign another vendor
                </button>
              </div>
            )}
            {visibleVendors.map((cv) => {
              const phase = getPhase(cv.status);
              const subLabel = getSubLabel(cv.status);
              const showDot = isVendor
                ? needsVendorAction(cv.status)
                : needsProducerAction(cv.status, isHop);

              return (
                <div
                  key={cv.id}
                  className={`relative rounded-lg border bg-surface-secondary p-3.5 transition-colors ${
                    showDot ? "border-amber-300/60" : "border-border"
                  }`}
                >
                  {/* Action-needed pulse dot */}
                  {showDot && (
                    <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  )}

                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Vendor name */}
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {cv.vendor?.companyName || "Unknown Vendor"}
                      </p>
                      {cv.vendor?.contactName && (
                        <p className="text-xs text-text-tertiary truncate">
                          {cv.vendor.contactName}
                          {cv.vendor.category && ` — ${cv.vendor.category}`}
                        </p>
                      )}

                      {/* Phase chip + sub-label */}
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${PHASE_STYLE[phase]}`}>
                          {PHASE_LABEL[phase]}
                        </span>
                        <span className="text-xs text-text-tertiary">{subLabel}</span>
                      </div>

                      {/* Financial summary */}
                      {(cv.estimateTotal > 0 || cv.paymentAmount > 0) && (
                        <div className="mt-2 flex gap-4 text-xs">
                          {cv.estimateTotal > 0 && (
                            <span className="text-text-tertiary">
                              Est: <span className="font-medium text-text-primary">{formatCurrency(cv.estimateTotal)}</span>
                            </span>
                          )}
                          {cv.paymentAmount > 0 && (
                            <span className="text-text-tertiary">
                              Paid: <span className="font-medium text-emerald-600">{formatCurrency(cv.paymentAmount)}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setManagingVendor(cv)}
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        Manage
                      </Button>
                      {!isVendor && !["Invoice Submitted", "Invoice Pre-Approved", "Invoice Approved", "Paid"].includes(cv.status) && (
                        <button
                          onClick={() => {
                            if (cv.status !== "Invited") {
                              if (!confirm(`Remove ${cv.vendor?.companyName}? This will discard their estimate and PO data.`)) return;
                            }
                            handleRemove(cv.id);
                          }}
                          className="text-text-tertiary hover:text-error transition-colors p-1"
                          title="Remove vendor"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Vendor lifecycle modal */}
        {managingVendor && (
          <VendorLifecycleModal
            open={!!managingVendor}
            onClose={() => setManagingVendor(null)}
            campaignVendor={managingVendor}
            campaignId={campaignId}
            wfNumber={wfNumber}
            onStatusChange={handleStatusChange}
          />
        )}

        {/* Assign vendor modal */}
        <AssignVendorModal
          open={showAssign}
          onClose={() => setShowAssign(false)}
          campaignId={campaignId}
          onAssigned={() => { mutate(); setShowAssign(false); }}
          existingVendorIds={campaignVendors.map((cv) => cv.vendorId)}
        />
      </>
    );
  }
);

// ─── Assign vendor modal ──────────────────────────────────────────────────────

function AssignVendorModal({
  open, onClose, campaignId, onAssigned, existingVendorIds,
}: {
  open: boolean; onClose: () => void; campaignId: string; onAssigned: () => void; existingVendorIds: string[];
}) {
  const { toast } = useToast();
  const { data: allVendors = [] } = useSWR<Vendor[]>(open ? "/api/vendors" : null, fetcher);
  const [assigning, setAssigning] = useState<string | null>(null);

  const available = allVendors.filter((v) => !existingVendorIds.includes(v.id));

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
                <p className="text-sm font-medium text-text-primary">{vendor.companyName}</p>
                <p className="text-xs text-text-tertiary">
                  {vendor.contactName}{vendor.category && ` — ${vendor.category}`}
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
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </ModalFooter>
    </Modal>
  );
}
