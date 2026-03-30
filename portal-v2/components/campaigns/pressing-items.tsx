"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { CampaignListItem } from "@/types/domain";
import { differenceInDays, parseISO, isPast } from "date-fns";
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  FileText,
  Clock,
  CheckCircle2,
} from "lucide-react";

interface Props {
  campaigns: CampaignListItem[];
}

interface PressingItem {
  level: "urgent" | "warning";
  icon: typeof AlertCircle;
  message: string;
  campaignName: string;
  campaignId: string;
}

export function PressingItems({ campaigns }: Props) {
  const items = useMemo(() => {
    const result: PressingItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const c of campaigns) {
      if (c.status === "Complete" || c.status === "Cancelled") continue;

      // Assets overdue
      if (c.assetsDeliveryDate && isPast(parseISO(c.assetsDeliveryDate))) {
        result.push({
          level: "urgent",
          icon: AlertCircle,
          message: "Assets overdue",
          campaignName: c.name,
          campaignId: c.id,
        });
      }

      // Upcoming shoots
      for (const shoot of c.shootsSummary) {
        for (const dateStr of shoot.dates) {
          const shootDate = parseISO(dateStr);
          const daysUntil = differenceInDays(shootDate, today);
          if (daysUntil >= 0 && daysUntil <= 3) {
            result.push({
              level: daysUntil <= 1 ? "urgent" : "warning",
              icon: Camera,
              message: daysUntil === 0
                ? `${shoot.name} — today`
                : daysUntil === 1
                ? `${shoot.name} — tomorrow`
                : `${shoot.name} — in ${daysUntil} days`,
              campaignName: c.name,
              campaignId: c.id,
            });
          }
        }
      }
    }

    // Sort urgent first
    result.sort((a, b) => (a.level === "urgent" ? -1 : 1) - (b.level === "urgent" ? -1 : 1));
    return result;
  }, [campaigns]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <CheckCircle2 className="h-6 w-6 text-emerald-400 mb-2" />
        <p className="text-sm font-medium text-text-primary">All caught up</p>
        <p className="text-xs text-text-tertiary mt-0.5">No pressing items right now</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <Link
            key={i}
            href={`/campaigns/${item.campaignId}`}
            className="flex items-start gap-2.5 rounded-lg p-2 hover:bg-surface-secondary transition-colors"
          >
            <Icon
              className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                item.level === "urgent" ? "text-red-500" : "text-amber-500"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary">{item.message}</p>
              <p className="text-[11px] text-text-tertiary truncate">{item.campaignName}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
