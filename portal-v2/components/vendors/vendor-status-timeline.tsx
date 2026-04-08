"use client";

import { VENDOR_STATUS_ORDER } from "@/lib/constants/statuses";
import type { CampaignVendorStatus } from "@/types/domain";
import { Check, Info } from "lucide-react";

const STEP_LABELS: Record<string, string> = {
  Invited: "Submit Your Estimate",
  "Estimate Revision Requested": "Revise and Resubmit",
  "Estimate Submitted": "Waiting for Review",
  "Estimate Approved": "Waiting for PO",
  "PO Uploaded": "Sign the PO",
  "PO Signed": "Waiting for Shoot Day",
  "Shoot Complete": "Upload Your Invoice",
  "Invoice Submitted": "Invoice Under Review",
  "Invoice Pre-Approved": "Final Approval Pending",
  "Invoice Approved": "Payment Processing",
  Paid: "Complete",
  Rejected: "Declined",
};

const STATUS_CONTEXT: Record<string, string> = {
  Invited: "You've been invited to this campaign. Submit an estimate to get started.",
  "Estimate Revision Requested":
    "The Producer requested estimate updates. Revise and resubmit your estimate.",
  "Estimate Submitted": "The Producer is reviewing your estimate. You'll hear back soon.",
  "Estimate Approved": "Your estimate was approved. The Producer will upload a PO for you to sign.",
  "PO Uploaded": "A Purchase Order is ready for your signature. Review and sign to confirm.",
  "PO Signed": "PO is signed. Waiting for the shoot to take place.",
  "Shoot Complete": "Shoot is done — upload your invoice to start the payment process.",
  "Invoice Submitted": "Your invoice is being reviewed by the Producer.",
  "Invoice Pre-Approved": "Producer approved. Waiting for final approval from Finance.",
  "Invoice Approved": "Fully approved. Payment will be processed within 5–10 business days.",
  Paid: "This assignment is complete. Thank you!",
  Rejected: "This invitation was declined. Contact the Producer if you have questions.",
};

interface Props {
  currentStatus: CampaignVendorStatus;
  estimateFeedback?: string | null;
}

export function VendorStatusTimeline({
  currentStatus,
  estimateFeedback,
}: Props) {
  const currentIndex = VENDOR_STATUS_ORDER.indexOf(currentStatus);
  const isRejected = currentStatus === "Rejected";
  const total = VENDOR_STATUS_ORDER.length;
  const stepNum = isRejected ? 0 : currentIndex + 1;
  const label = STEP_LABELS[currentStatus] || currentStatus;
  const context =
    currentStatus === "Estimate Revision Requested" && estimateFeedback?.trim()
      ? `Revision requested: ${estimateFeedback.trim()}`
      : STATUS_CONTEXT[currentStatus] || "";
  const progressPct = isRejected ? 0 : ((currentIndex + 1) / total) * 100;

  return (
    <div className="space-y-2.5 py-1">
      {/* Step header + progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-text-primary">
            {isRejected ? "Declined" : `Step ${stepNum} of ${total}`}
            <span className="font-normal text-text-secondary"> · {label}</span>
          </p>
        </div>
        <div className="h-1.5 w-full rounded-full bg-surface-tertiary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isRejected ? "bg-red-400" : currentStatus === "Paid" ? "bg-emerald-500" : "bg-primary"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Dot timeline */}
      <div className="flex items-center gap-0 w-full">
        {VENDOR_STATUS_ORDER.map((status, i) => {
          const isComplete = i < currentIndex && !isRejected;
          const isCurrent = status === currentStatus;

          return (
            <div key={status} className="flex items-center flex-1 last:flex-none">
              <div
                title={status}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold transition-all ${
                  isComplete
                    ? "bg-emerald-100 text-emerald-600"
                    : isCurrent && isRejected
                    ? "bg-red-100 text-red-600 ring-2 ring-red-300"
                    : isCurrent
                    ? "bg-primary text-white ring-2 ring-primary/30"
                    : "bg-surface-tertiary text-text-tertiary"
                }`}
              >
                {isComplete ? <Check className="h-2.5 w-2.5" /> : i + 1}
              </div>
              {i < VENDOR_STATUS_ORDER.length - 1 && (
                <div
                  className={`h-px flex-1 mx-0.5 ${
                    isComplete ? "bg-emerald-300" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Contextual help message */}
      {context && (
        <div className="flex gap-2 rounded-lg bg-surface-secondary p-2 text-xs text-text-secondary">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
          <p>{context}</p>
        </div>
      )}
    </div>
  );
}
