import type {
  Campaign,
  Shoot,
  CampaignVendor,
  CampaignFinancials,
  AttentionItem,
} from "@/types/domain";

export function getAttentionItems(opts: {
  campaign: Campaign;
  shoots: Shoot[];
  vendors?: CampaignVendor[];
  financials?: CampaignFinancials;
}): AttentionItem[] {
  const items: AttentionItem[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const { campaign, shoots, vendors = [], financials } = opts;

  if (campaign.status === "Complete" || campaign.status === "Cancelled") {
    return items;
  }

  // --- Shoot-related ---
  const allDates = shoots.flatMap((s) =>
    s.dates.map((d) => ({ ...d, shootName: s.name }))
  );

  for (const d of allDates) {
    const shootDate = new Date(d.shootDate);
    const daysUntil = Math.ceil(
      (shootDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntil >= 0 && daysUntil <= 1) {
      items.push({
        level: "urgent",
        category: "shoot",
        message: daysUntil === 0 ? "Shoot today" : "Shoot tomorrow",
        action: "shoots",
      });
    } else if (daysUntil > 1 && daysUntil <= 3) {
      items.push({
        level: "warning",
        category: "shoot",
        message: `Shoot in ${daysUntil} days`,
        action: "shoots",
      });
    }
  }

  // --- Assets delivery ---
  if (campaign.assetsDeliveryDate) {
    const dueDate = new Date(campaign.assetsDeliveryDate);
    if (dueDate < today) {
      items.push({
        level: "urgent",
        category: "delivery",
        message: "Assets past due",
        action: "files",
      });
    }
  }

  // --- Vendor-related ---
  const pendingEstimates = vendors.filter((v) => v.status === "Invited");
  if (pendingEstimates.length > 0) {
    const oldOnes = pendingEstimates.filter((v) => {
      const days = Math.ceil(
        (now.getTime() - new Date(v.invitedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      return days > 3;
    });
    if (oldOnes.length > 0) {
      items.push({
        level: "warning",
        category: "vendor",
        message: `${oldOnes.length} estimate${oldOnes.length > 1 ? "s" : ""} pending > 3 days`,
        action: "vendors",
      });
    }
  }

  const unsignedPOs = vendors.filter((v) => v.status === "PO Uploaded");
  if (unsignedPOs.length > 0) {
    items.push({
      level: "warning",
      category: "vendor",
      message: `${unsignedPOs.length} PO${unsignedPOs.length > 1 ? "s" : ""} awaiting signature`,
      action: "vendors",
    });
  }

  const pendingInvoices = vendors.filter(
    (v) => v.status === "Invoice Submitted" || v.status === "Invoice Pre-Approved"
  );
  if (pendingInvoices.length > 0) {
    items.push({
      level: "info",
      category: "vendor",
      message: `${pendingInvoices.length} invoice${pendingInvoices.length > 1 ? "s" : ""} to review`,
      action: "vendors",
    });
  }

  const newEstimates = vendors.filter((v) => v.status === "Estimate Submitted");
  if (newEstimates.length > 0) {
    items.push({
      level: "info",
      category: "vendor",
      message: `${newEstimates.length} new estimate${newEstimates.length > 1 ? "s" : ""} submitted`,
      action: "vendors",
    });
  }

  // --- Budget-related ---
  if (financials && financials.budget > 0) {
    const remainingPct = financials.remaining / financials.budget;
    if (remainingPct < 0) {
      items.push({
        level: "urgent",
        category: "budget",
        message: "Over budget",
        action: "budget",
      });
    } else if (remainingPct < 0.1) {
      items.push({
        level: "warning",
        category: "budget",
        message: "Budget < 10% remaining",
        action: "budget",
      });
    }
  }

  // Sort: urgent first, then warning, then info
  const order = { urgent: 0, warning: 1, info: 2 };
  items.sort((a, b) => order[a.level] - order[b.level]);

  return items;
}

export function getTopAttentionLevel(
  items: AttentionItem[]
): "urgent" | "warning" | "info" | "clear" {
  if (items.length === 0) return "clear";
  return items[0].level;
}
