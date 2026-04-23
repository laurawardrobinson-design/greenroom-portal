import type { CampaignStatus, CampaignVendorStatus } from "@/types/domain";
import type { StatusVariant } from "@/components/ui/status-pill";

// Campaign status flow
export const CAMPAIGN_STATUS_ORDER: CampaignStatus[] = [
  "Planning",
  "Upcoming",
  "In Production",
  "Post",
  "Complete",
];

/**
 * Map a campaign status to a StatusPill variant. Single source of truth —
 * do not inline-map these colors in components.
 */
export function campaignStatusVariant(status: CampaignStatus): StatusVariant {
  switch (status) {
    case "Planning":
      return "draft";
    case "Upcoming":
      return "pending";
    case "In Production":
      return "info";
    case "Post":
      return "submitted";
    case "Complete":
      return "approved";
    case "Cancelled":
      return "rejected";
  }
}

/**
 * Inline style bundle for campaign status, for callers that need a span
 * style object rather than the StatusPill component. Prefer StatusPill
 * where possible.
 */
export function campaignStatusStyle(status: CampaignStatus): {
  color: string;
  backgroundColor: string;
} {
  const v = campaignStatusVariant(status);
  return {
    color: `var(--status-${v}-fg)`,
    backgroundColor: `var(--status-${v}-tint)`,
  };
}

/**
 * Back-compat: a Tailwind class string for legacy call sites. New code
 * should use StatusPill + campaignStatusVariant(). These classes use
 * design-token-aware utilities via bracket syntax so a single change to
 * globals.css re-themes the app.
 */
export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, string> = {
  Planning:
    "text-[color:var(--status-draft-fg)] bg-[color:var(--status-draft-tint)]",
  Upcoming:
    "text-[color:var(--status-pending-fg)] bg-[color:var(--status-pending-tint)]",
  "In Production":
    "text-[color:var(--status-info-fg)] bg-[color:var(--status-info-tint)]",
  Post:
    "text-[color:var(--status-submitted-fg)] bg-[color:var(--status-submitted-tint)]",
  Complete:
    "text-[color:var(--status-approved-fg)] bg-[color:var(--status-approved-tint)]",
  Cancelled:
    "text-[color:var(--status-rejected-fg)] bg-[color:var(--status-rejected-tint)]",
};

// Vendor PO lifecycle — allowed transitions (state machine)
export const VENDOR_STATUS_TRANSITIONS: Record<
  CampaignVendorStatus,
  CampaignVendorStatus[]
> = {
  Invited: ["Estimate Submitted", "Rejected"],
  "Estimate Submitted": ["Estimate Approved", "Rejected"],
  "Estimate Approved": ["PO Uploaded", "Rejected"],
  "PO Uploaded": ["PO Signed", "Rejected"],
  "PO Signed": ["Shoot Complete", "Rejected"],
  "Shoot Complete": ["Invoice Submitted"],
  "Invoice Submitted": ["Invoice Pre-Approved", "Rejected"],
  "Invoice Pre-Approved": ["Invoice Approved", "Rejected"],
  "Invoice Approved": ["Paid"],
  Paid: [],
  Rejected: ["Invited"],
};

export const VENDOR_STATUS_ORDER: CampaignVendorStatus[] = [
  "Invited",
  "Estimate Submitted",
  "Estimate Approved",
  "PO Uploaded",
  "PO Signed",
  "Shoot Complete",
  "Invoice Submitted",
  "Invoice Pre-Approved",
  "Invoice Approved",
  "Paid",
];

export function vendorStatusVariant(status: CampaignVendorStatus): StatusVariant {
  switch (status) {
    case "Invited":
      return "draft";
    case "Estimate Submitted":
    case "Invoice Submitted":
      return "pending";
    case "Estimate Approved":
    case "Invoice Approved":
    case "Paid":
      return "approved";
    case "PO Uploaded":
    case "PO Signed":
      return "info";
    case "Shoot Complete":
    case "Invoice Pre-Approved":
      return "submitted";
    case "Rejected":
      return "rejected";
  }
}

export function vendorStatusStyle(status: CampaignVendorStatus): {
  color: string;
  backgroundColor: string;
} {
  const v = vendorStatusVariant(status);
  return {
    color: `var(--status-${v}-fg)`,
    backgroundColor: `var(--status-${v}-tint)`,
  };
}

export const VENDOR_STATUS_COLORS: Record<CampaignVendorStatus, string> = {
  Invited:
    "text-[color:var(--status-draft-fg)] bg-[color:var(--status-draft-tint)]",
  "Estimate Submitted":
    "text-[color:var(--status-pending-fg)] bg-[color:var(--status-pending-tint)]",
  "Estimate Approved":
    "text-[color:var(--status-approved-fg)] bg-[color:var(--status-approved-tint)]",
  "PO Uploaded":
    "text-[color:var(--status-info-fg)] bg-[color:var(--status-info-tint)]",
  "PO Signed":
    "text-[color:var(--status-info-fg)] bg-[color:var(--status-info-tint)]",
  "Shoot Complete":
    "text-[color:var(--status-submitted-fg)] bg-[color:var(--status-submitted-tint)]",
  "Invoice Submitted":
    "text-[color:var(--status-pending-fg)] bg-[color:var(--status-pending-tint)]",
  "Invoice Pre-Approved":
    "text-[color:var(--status-submitted-fg)] bg-[color:var(--status-submitted-tint)]",
  "Invoice Approved":
    "text-[color:var(--status-approved-fg)] bg-[color:var(--status-approved-tint)]",
  Paid:
    "text-[color:var(--status-approved-fg)] bg-[color:var(--status-approved-tint)]",
  Rejected:
    "text-[color:var(--status-rejected-fg)] bg-[color:var(--status-rejected-tint)]",
};
