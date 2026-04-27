"use client";

import Link from "next/link";
import type { CampaignListItem, ShootSummary } from "@/types/domain";
import { formatCurrency } from "@/lib/utils/format";
import { campaignStatusStyle } from "@/lib/constants/statuses";
import { format, parseISO, isPast, differenceInDays } from "date-fns";

interface CampaignCardProps {
  campaign: CampaignListItem;
  hideFinancials?: boolean;
  href?: string;
}

// Shoot-type dot is categorical, not semantic state — keep distinct hues via tokens.
const SHOOT_TYPE_COLOR: Record<string, string> = {
  Photo: "var(--color-info)",
  Video: "var(--role-designer-fg)",
  Hybrid: "var(--color-warning)",
  Other: "var(--color-text-tertiary)",
};

function formatShootDates(dates: string[]): string {
  if (dates.length === 0) return "";
  if (dates.length === 1) return format(parseISO(dates[0]), "MMM d");

  // Check if consecutive
  const sorted = [...dates].sort();
  const first = parseISO(sorted[0]);
  const last = parseISO(sorted[sorted.length - 1]);
  const daySpan = differenceInDays(last, first);

  if (daySpan === sorted.length - 1 && sorted.length > 1) {
    // Consecutive range
    return `${format(first, "MMM d")}–${format(last, "d")}`;
  }

  // Non-consecutive, show first two
  return sorted.slice(0, 2).map((d) => format(parseISO(d), "MMM d")).join(", ") +
    (sorted.length > 2 ? ` +${sorted.length - 2}` : "");
}

export function CampaignCard({ campaign, hideFinancials, href }: CampaignCardProps) {
  const pillStyle = campaignStatusStyle(campaign.status);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const assetsOverdue = campaign.assetsDeliveryDate
    ? isPast(parseISO(campaign.assetsDeliveryDate))
    : false;
  const assetsDaysLeft = campaign.assetsDeliveryDate
    ? differenceInDays(parseISO(campaign.assetsDeliveryDate), today)
    : null;

  const budgetPct = campaign.productionBudget > 0
    ? Math.min((campaign.committed / campaign.productionBudget) * 100, 100)
    : 0;
  const budgetBarColor =
    budgetPct > 95 ? "bg-error" : budgetPct > 80 ? "bg-warning" : "bg-primary";

  // Take up to 3 shoots for display
  const shootsToShow = campaign.shootsSummary.slice(0, 3);

  return (
    <Link href={href ?? `/campaigns/${campaign.id}`}>
      <div className="group flex flex-col rounded-xl bg-surface border border-transparent shadow-sm hover:shadow-md hover:border-border transition-all duration-200 p-5 h-full">
        {/* WF# above name */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] text-text-tertiary tracking-wide">
            {campaign.wfNumber || "\u00A0"}
          </span>
          <span
            className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={pillStyle}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: pillStyle.color }}
            />
            {campaign.status}
          </span>
        </div>

        {/* Campaign name */}
        <h3 className="text-[16px] font-semibold text-text-primary leading-snug line-clamp-2 mb-3">
          {campaign.name}
        </h3>

        {/* Assets Due */}
        {campaign.assetsDeliveryDate && (
          <div className="mb-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-0.5">
              Assets Due
            </p>
            <p className="text-[16px] font-bold text-primary">
              {format(parseISO(campaign.assetsDeliveryDate), "MMM d, yyyy")}
            </p>
          </div>
        )}

        {/* Upcoming Shoots */}
        {shootsToShow.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">
              Upcoming Shoots
            </p>
            <div className="space-y-1">
              {shootsToShow.map((shoot, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px]">
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: SHOOT_TYPE_COLOR[shoot.shootType] ?? SHOOT_TYPE_COLOR.Other }}
                  />
                  <span className="text-text-secondary truncate">
                    {shoot.name}
                  </span>
                  {shoot.dates.length > 0 && (
                    <span className="text-text-tertiary ml-auto shrink-0 text-[11px]">
                      {formatShootDates(shoot.dates)}
                    </span>
                  )}
                </div>
              ))}
              {campaign.shootsSummary.length > 3 && (
                <p className="text-[11px] text-text-tertiary">
                  +{campaign.shootsSummary.length - 3} more
                </p>
              )}
            </div>
          </div>
        )}

        {/* Budget bar — pinned to bottom */}
        {!hideFinancials && <div className="mt-auto pt-3">
          {campaign.productionBudget > 0 ? (
            <>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11px] font-medium text-text-secondary">
                  {formatCurrency(campaign.committed)} committed
                </span>
                <span className="text-[11px] text-text-tertiary">
                  of {formatCurrency(campaign.productionBudget)}
                </span>
              </div>
              <div className="h-[3px] rounded-full bg-surface-tertiary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${budgetBarColor}`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
            </>
          ) : (
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-text-tertiary">No budget set</span>
            </div>
          )}
        </div>}
      </div>
    </Link>
  );
}
