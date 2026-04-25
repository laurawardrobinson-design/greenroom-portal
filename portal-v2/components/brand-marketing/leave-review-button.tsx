"use client";

import { useState } from "react";
import useSWR from "swr";
import { Check, MessageSquareWarning, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type {
  ApprovalSubjectType,
  BrandApproval,
  DecisionState,
} from "@/lib/services/brand-approvals.service";
import { APPROVAL_STATE_LABELS } from "./approval-state-pill";

interface LeaveReviewButtonProps {
  subjectType: ApprovalSubjectType;
  subjectId: string;
  campaignId: string;
  // Gate: only shown to BMM + Admin on campaigns the BMM owns.
  canReview: boolean;
}

const fetcher = async (url: string): Promise<BrandApproval[]> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Failed");
  return r.json();
};

export function LeaveReviewButton({
  subjectType,
  subjectId,
  campaignId,
  canReview,
}: LeaveReviewButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState<DecisionState | null>(null);

  const trailUrl = `/api/brand-approvals?subject_type=${subjectType}&subject_id=${subjectId}`;
  const { mutate } = useSWR<BrandApproval[]>(trailUrl, fetcher);

  if (!canReview) return null;

  async function leaveReview(decision: DecisionState) {
    if (decision !== "approved" && comment.trim().length === 0) {
      toast(
        "error",
        `Tell the producer what needs to change before marking "${APPROVAL_STATE_LABELS[decision]}".`
      );
      return;
    }
    setSubmitting(decision);
    try {
      const r = await fetch("/api/brand-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectType,
          subjectId,
          campaignId,
          comment,
          state: decision,
        }),
      });
      if (!r.ok) {
        const err = (await r.json()).error ?? "Failed";
        toast("error", `Couldn't save review: ${err}`);
        return;
      }
      await mutate();
      setOpen(false);
      setComment("");
      toast("success", `Marked ${APPROVAL_STATE_LABELS[decision].toLowerCase()}`);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" />
        Leave brand review
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Leave brand review" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Your note goes to the producer on this subject. Be specific about what to
            change so they don't have to guess.
          </p>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g., Positioning needs to re-anchor to Publix Premium language — see examples."
            rows={5}
          />
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              className="text-error hover:bg-error/5"
              style={{ borderColor: "var(--status-rejected-border)" }}
              onClick={() => leaveReview("rejected")}
              disabled={submitting !== null}
            >
              <X className="h-3.5 w-3.5" />
              {submitting === "rejected" ? "Saving..." : "Reject"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => leaveReview("changes_requested")}
              disabled={submitting !== null}
            >
              <MessageSquareWarning className="h-3.5 w-3.5" />
              {submitting === "changes_requested" ? "Saving..." : "Request changes"}
            </Button>
            <Button
              onClick={() => leaveReview("approved")}
              disabled={submitting !== null}
            >
              <Check className="h-3.5 w-3.5" />
              {submitting === "approved" ? "Saving..." : "Approve"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
