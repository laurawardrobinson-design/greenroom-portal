"use client";

import type { CampaignVendorStatus } from "@/types/domain";
import { Check, Info } from "lucide-react";

const STAGES = [
  { id: "estimate", label: "Estimate" },
  { id: "po", label: "PO" },
  { id: "invoice", label: "Invoice" },
] as const;

const STAGE_BY_STATUS: Record<CampaignVendorStatus, (typeof STAGES)[number]["id"]> = {
  Invited: "estimate",
  "Estimate Submitted": "estimate",
  "Estimate Approved": "estimate",
  "PO Uploaded": "po",
  "PO Signed": "po",
  "Shoot Complete": "po",
  "Invoice Submitted": "invoice",
  "Invoice Pre-Approved": "invoice",
  "Invoice Approved": "invoice",
  Paid: "invoice",
  Rejected: "estimate",
};

const STATUS_BADGE: Record<CampaignVendorStatus, { label: string; tone: string }> = {
  Invited: { label: "Action Needed", tone: "bg-slate-100 text-slate-700" },
  "Estimate Submitted": { label: "In Review", tone: "bg-amber-50 text-amber-700" },
  "Estimate Approved": { label: "Complete", tone: "bg-emerald-50 text-emerald-700" },
  "PO Uploaded": { label: "Action Needed", tone: "bg-blue-50 text-blue-700" },
  "PO Signed": { label: "Complete", tone: "bg-emerald-50 text-emerald-700" },
  "Shoot Complete": { label: "Ready", tone: "bg-purple-50 text-purple-700" },
  "Invoice Submitted": { label: "In Review", tone: "bg-amber-50 text-amber-700" },
  "Invoice Pre-Approved": { label: "Final Approval", tone: "bg-teal-50 text-teal-700" },
  "Invoice Approved": { label: "Processing", tone: "bg-emerald-50 text-emerald-700" },
  Paid: { label: "Paid", tone: "bg-emerald-100 text-emerald-800" },
  Rejected: { label: "Declined", tone: "bg-red-50 text-red-700" },
};

const STATUS_LABEL: Record<CampaignVendorStatus, string> = {
  Invited: "Submit your estimate",
  "Estimate Submitted": "Waiting for producer review",
  "Estimate Approved": "Estimate approved",
  "PO Uploaded": "PO uploaded, awaiting signature",
  "PO Signed": "PO signed",
  "Shoot Complete": "Shoot complete, ready for invoice",
  "Invoice Submitted": "Invoice under review",
  "Invoice Pre-Approved": "Awaiting HOP approval",
  "Invoice Approved": "Invoice approved",
  Paid: "Payment complete",
  Rejected: "Request was declined",
};

const STATUS_CONTEXT: Record<string, string> = {
  Invited: "You've been invited to this campaign. Submit an estimate to get started.",
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
}

export function VendorStatusTimeline({ currentStatus }: Props) {
  const isRejected = currentStatus === "Rejected";
  const currentStage = STAGE_BY_STATUS[currentStatus];
  const currentStageIndex = STAGES.findIndex((stage) => stage.id === currentStage);
  const badge = STATUS_BADGE[currentStatus];
  const label = STATUS_LABEL[currentStatus] || currentStatus;
  const context = STATUS_CONTEXT[currentStatus] || "";
  const progressPct = isRejected
    ? 0
    : currentStatus === "Paid"
    ? 100
    : ((currentStageIndex + 1) / STAGES.length) * 100;

  return (
    <div className="space-y-2.5 py-1">
      {/* Step header + progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-text-primary">
            {isRejected ? "Estimate" : STAGES[currentStageIndex]?.label || "Estimate"}
            <span className="font-normal text-text-secondary"> · {label}</span>
          </p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badge.tone}`}>
            {badge.label}
          </span>
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
        {STAGES.map((stage, i) => {
          const isComplete = !isRejected && (currentStatus === "Paid" || i < currentStageIndex);
          const isCurrent = !isRejected && i === currentStageIndex;

          return (
            <div key={stage.id} className="flex items-center flex-1 last:flex-none">
              <div
                title={stage.label}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
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
              {i < STAGES.length - 1 && (
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
      <div className="grid grid-cols-3 text-[10px] uppercase tracking-wide text-text-tertiary">
        {STAGES.map((stage) => (
          <span key={stage.id} className="text-center">{stage.label}</span>
        ))}
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
