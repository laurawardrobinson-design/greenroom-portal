import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { LobChip } from "./lob-chip";
import type { PortfolioCampaign } from "@/lib/services/brand-marketing.service";

interface RailInMarketProps {
  campaigns: PortfolioCampaign[];
}

function formatMonthDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function daysUntil(iso: string): number {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function RailInMarket({ campaigns }: RailInMarketProps) {
  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader>
        <CardTitle>
          <CalendarClock />
          <span>Shooting</span>
        </CardTitle>
        <span className="text-[13px] font-normal text-text-tertiary normal-case tracking-normal">
          {campaigns.length} {campaigns.length === 1 ? "delivery" : "deliveries"}
        </span>
      </CardHeader>

      {campaigns.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-text-primary font-medium">Nothing in production in the next 30 days.</p>
          <p className="mt-1 text-sm text-text-secondary">
            Campaigns with upcoming delivery dates line up here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {campaigns.map((c) => {
            const days = c.assetsDeliveryDate ? daysUntil(c.assetsDeliveryDate) : null;
            const relative =
              days === null
                ? null
                : days === 0
                  ? "today"
                  : days === 1
                    ? "tomorrow"
                    : `in ${days} days`;
            return (
              <li key={c.id}>
                <Link
                  href={`/campaigns/${c.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-surface-secondary transition-colors"
                >
                  <div className="w-16 shrink-0">
                    <div className="text-sm font-semibold text-text-primary">
                      {c.assetsDeliveryDate ? formatMonthDay(c.assetsDeliveryDate) : "—"}
                    </div>
                    {relative && (
                      <div className="text-[11px] text-text-tertiary">{relative}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-text-tertiary">{c.wfNumber}</span>
                      <span className="text-sm font-medium text-text-primary truncate">
                        {c.name}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <LobChip lob={c.lineOfBusiness} />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
