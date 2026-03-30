"use client";

import Link from "next/link";
import type { CampaignListItem } from "@/types/domain";
import { CampaignStatusBadge } from "./campaign-status-badge";
import { formatCurrency } from "@/lib/utils/format";
import { format, parseISO, differenceInDays } from "date-fns";

interface Props {
  campaign: CampaignListItem;
}

export function CampaignRow({ campaign }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Date urgency
  const nextShootDays = campaign.nextShootDate
    ? differenceInDays(parseISO(campaign.nextShootDate), today)
    : null;
  const shootUrgent = nextShootDays !== null && nextShootDays >= 0 && nextShootDays <= 3;

  const assetsOverdue = campaign.assetsDeliveryDate
    ? parseISO(campaign.assetsDeliveryDate) < today
    : false;

  // Attention level
  const hasUrgent = assetsOverdue || (nextShootDays !== null && nextShootDays <= 1 && nextShootDays >= 0);
  const hasWarning = shootUrgent && !hasUrgent;

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="flex items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3 hover:bg-surface-secondary transition-colors group"
    >
      {/* Attention dot */}
      <div className="w-2.5 shrink-0 flex justify-center">
        {hasUrgent ? (
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
        ) : hasWarning ? (
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        ) : null}
      </div>

      {/* WF Number */}
      <div className="w-24 shrink-0">
        <span className="text-[10px] font-mono text-text-secondary">
          {campaign.wfNumber || "—"}
        </span>
      </div>

      {/* Campaign Name */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors truncate block">
          {campaign.name}
        </span>
      </div>

      {/* Status */}
      <div className="w-28 shrink-0">
        <CampaignStatusBadge status={campaign.status} />
      </div>

      {/* Next Shoot */}
      <div className="w-24 shrink-0 text-right">
        <span
          className={`text-xs ${
            shootUrgent
              ? "text-red-600 font-medium"
              : "text-text-secondary"
          }`}
        >
          {campaign.nextShootDate
            ? format(parseISO(campaign.nextShootDate), "MMM d, yyyy")
            : "—"}
        </span>
      </div>

      {/* Assets Due */}
      <div className="w-24 shrink-0 text-right hidden lg:block">
        <span
          className={`text-xs ${
            assetsOverdue
              ? "text-red-600 font-medium"
              : "text-text-secondary"
          }`}
        >
          {campaign.assetsDeliveryDate
            ? format(parseISO(campaign.assetsDeliveryDate), "MMM d, yyyy")
            : "—"}
        </span>
      </div>

      {/* Budget */}
      <div className="w-20 shrink-0 text-right">
        <span className="text-xs text-text-secondary">
          {campaign.productionBudget
            ? formatCurrency(campaign.productionBudget)
            : "—"}
        </span>
      </div>
    </Link>
  );
}
