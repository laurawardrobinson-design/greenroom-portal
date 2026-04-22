"use client";

import useSWR from "swr";
import type {
  ApprovalSubjectType,
  BrandApproval,
} from "@/lib/services/brand-approvals.service";
import { ApprovalStatePill } from "./approval-state-pill";

const fetcher = async (url: string): Promise<BrandApproval[]> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Failed");
  return r.json();
};

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface ApprovalTrailProps {
  subjectType: ApprovalSubjectType;
  subjectId: string | null | undefined;
  // Used to label the trail's most-recent decision on the subject page.
  compact?: boolean;
}

export function ApprovalTrail({ subjectType, subjectId, compact }: ApprovalTrailProps) {
  const url = subjectId
    ? `/api/brand-approvals?subject_type=${subjectType}&subject_id=${subjectId}`
    : null;
  const { data: trail } = useSWR<BrandApproval[]>(url, fetcher);

  if (!subjectId || !trail || trail.length === 0) {
    return compact ? null : (
      <p className="text-[11px] text-text-tertiary">No approval requested yet.</p>
    );
  }

  if (compact) {
    const latest = trail[0];
    return (
      <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
        <ApprovalStatePill state={latest.state} />
        <span>{formatRelative(latest.decidedAt ?? latest.updatedAt)}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {trail.map((a) => (
        <div key={a.id} className="flex items-start gap-3 text-sm">
          <div className="mt-0.5">
            <ApprovalStatePill state={a.state} />
          </div>
          <div className="flex-1 min-w-0">
            {a.comment && (
              <p className="text-text-primary whitespace-pre-wrap">{a.comment}</p>
            )}
            <p className="mt-1 text-[11px] text-text-tertiary">
              {a.state === "pending"
                ? `Requested ${formatRelative(a.createdAt)}`
                : `${a.state === "approved" ? "Approved" : a.state === "rejected" ? "Rejected" : a.state === "changes_requested" ? "Changes requested" : "Withdrawn"} ${formatRelative(a.decidedAt ?? a.updatedAt)}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
