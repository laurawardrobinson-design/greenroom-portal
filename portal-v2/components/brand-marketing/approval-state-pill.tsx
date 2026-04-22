import type { ApprovalState } from "@/lib/services/brand-approvals.service";

const STYLES: Record<ApprovalState, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200/60",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200/60",
  changes_requested: "bg-orange-50 text-orange-800 ring-orange-200/60",
  rejected: "bg-red-50 text-red-800 ring-red-200/60",
  withdrawn: "bg-slate-100 text-slate-600 ring-slate-200/60",
};

const LABELS: Record<ApprovalState, string> = {
  pending: "Pending review",
  approved: "Approved",
  changes_requested: "Changes requested",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export function ApprovalStatePill({ state }: { state: ApprovalState }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ring-1 ring-inset ${STYLES[state]}`}
    >
      {LABELS[state]}
    </span>
  );
}

export { LABELS as APPROVAL_STATE_LABELS };
