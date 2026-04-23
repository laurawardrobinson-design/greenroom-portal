import { StatusPill, type StatusVariant } from "@/components/ui/status-pill";
import type { ApprovalState } from "@/lib/services/brand-approvals.service";

const VARIANT: Record<ApprovalState, StatusVariant> = {
  pending: "pending",
  approved: "approved",
  changes_requested: "pending",
  rejected: "rejected",
  withdrawn: "draft",
};

const LABELS: Record<ApprovalState, string> = {
  pending: "Pending review",
  approved: "Approved",
  changes_requested: "Changes requested",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export function ApprovalStatePill({ state }: { state: ApprovalState }) {
  return <StatusPill variant={VARIANT[state]}>{LABELS[state]}</StatusPill>;
}

export { LABELS as APPROVAL_STATE_LABELS };
