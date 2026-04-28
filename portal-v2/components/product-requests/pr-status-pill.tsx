"use client";

import { StatusPill, type StatusVariant } from "@/components/ui/status-pill";
import type { PRDocStatus } from "@/types/domain";
import { PR_STATUS_LABELS } from "@/types/domain";

const VARIANT: Record<PRDocStatus, StatusVariant> = {
  draft: "draft",
  submitted: "pending",
  forwarded: "info",
  confirmed: "approved",
  cancelled: "draft",
};

export function PRStatusPill({
  status,
  className = "",
}: {
  status: PRDocStatus;
  className?: string;
}) {
  return (
    <StatusPill variant={VARIANT[status]} className={className}>
      {PR_STATUS_LABELS[status]}
    </StatusPill>
  );
}
