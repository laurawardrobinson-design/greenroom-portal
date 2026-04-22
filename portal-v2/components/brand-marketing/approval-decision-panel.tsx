"use client";

import { useState } from "react";
import { Check, MessageSquareWarning, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { BrandApprovalQueueItem, DecisionState } from "@/lib/services/brand-approvals.service";
import { APPROVAL_STATE_LABELS } from "./approval-state-pill";

interface ApprovalDecisionPanelProps {
  open: boolean;
  approval: BrandApprovalQueueItem | null;
  onClose: () => void;
  onDecided: () => void;
}

export function ApprovalDecisionPanel({
  open,
  approval,
  onClose,
  onDecided,
}: ApprovalDecisionPanelProps) {
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState<DecisionState | null>(null);

  async function decide(decision: DecisionState) {
    if (!approval) return;
    if (decision !== "approved" && comment.trim().length === 0) {
      toast({
        title: "Comment required",
        description: `Tell the producer what needs to change before marking "${APPROVAL_STATE_LABELS[decision]}".`,
        variant: "error",
      });
      return;
    }
    setSubmitting(decision);
    try {
      const r = await fetch(`/api/brand-approvals/${approval.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment }),
      });
      if (!r.ok) {
        const err = (await r.json()).error ?? "Failed";
        toast({ title: "Couldn't save decision", description: err, variant: "error" });
        return;
      }
      toast({
        title: `Marked ${APPROVAL_STATE_LABELS[decision].toLowerCase()}`,
        description: approval.campaignName,
        variant: "success",
      });
      setComment("");
      onDecided();
      onClose();
    } finally {
      setSubmitting(null);
    }
  }

  if (!approval) {
    return (
      <Modal open={open} onClose={onClose} title="Brand review" size="lg">
        <p className="text-sm text-text-secondary">No item selected.</p>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Brand review" size="lg">
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
            {approval.subjectLabel}
          </p>
          <h3 className="text-base font-semibold text-text-primary">
            {approval.campaignName}
          </h3>
          <p className="text-xs text-text-tertiary">
            {approval.campaignWfNumber}
            {approval.requesterName ? ` · Requested by ${approval.requesterName}` : ""}
          </p>
        </div>

        {approval.comment && (
          <div className="rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary whitespace-pre-wrap">
            {approval.comment}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">
            Your note to the producer
          </label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Required for 'changes requested' and 'rejected'. Optional for 'approved'."
            rows={5}
          />
          <p className="text-[11px] text-text-tertiary">
            Tip: be specific about what to change. The producer sees exactly this
            note and nothing else.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            className="text-red-700 border-red-200 hover:bg-red-50"
            onClick={() => decide("rejected")}
            disabled={submitting !== null}
          >
            <X className="h-3.5 w-3.5" />
            {submitting === "rejected" ? "Saving..." : "Reject"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => decide("changes_requested")}
            disabled={submitting !== null}
          >
            <MessageSquareWarning className="h-3.5 w-3.5" />
            {submitting === "changes_requested" ? "Saving..." : "Request changes"}
          </Button>
          <Button
            onClick={() => decide("approved")}
            disabled={submitting !== null}
          >
            <Check className="h-3.5 w-3.5" />
            {submitting === "approved" ? "Saving..." : "Approve"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
