import type { CampaignStatus, CampaignVendorStatus } from "@/types/domain";

// Campaign status flow
export const CAMPAIGN_STATUS_ORDER: CampaignStatus[] = [
  "Planning",
  "Upcoming",
  "In Production",
  "Post",
  "Complete",
];

export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, string> = {
  Planning: "bg-slate-100 text-slate-700",
  Upcoming: "bg-amber-50 text-amber-700",
  "In Production": "bg-blue-50 text-blue-700",
  Post: "bg-purple-50 text-purple-700",
  Complete: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-red-50 text-red-600",
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

export const VENDOR_STATUS_COLORS: Record<CampaignVendorStatus, string> = {
  Invited: "bg-slate-100 text-slate-600",
  "Estimate Submitted": "bg-amber-50 text-amber-700",
  "Estimate Approved": "bg-emerald-50 text-emerald-700",
  "PO Uploaded": "bg-blue-50 text-blue-700",
  "PO Signed": "bg-blue-100 text-blue-800",
  "Shoot Complete": "bg-purple-50 text-purple-700",
  "Invoice Submitted": "bg-amber-50 text-amber-700",
  "Invoice Pre-Approved": "bg-teal-50 text-teal-700",
  "Invoice Approved": "bg-emerald-50 text-emerald-700",
  Paid: "bg-emerald-100 text-emerald-800",
  Rejected: "bg-red-50 text-red-600",
};
