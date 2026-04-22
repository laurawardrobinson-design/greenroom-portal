"use client";

import { Badge } from "@/components/ui/badge";
import type { PRDocStatus } from "@/types/domain";
import { PR_STATUS_LABELS } from "@/types/domain";

const statusStyles: Record<PRDocStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  submitted: "bg-amber-50 text-amber-700",
  forwarded: "bg-sky-50 text-sky-700",
  fulfilled: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-400",
};

export function PRStatusPill({ status }: { status: PRDocStatus }) {
  return (
    <Badge variant="custom" className={statusStyles[status]}>
      {PR_STATUS_LABELS[status]}
    </Badge>
  );
}
