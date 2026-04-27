import Link from "next/link";
import { Film } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { LobChip } from "./lob-chip";
import type { PortfolioCampaign } from "@/lib/services/brand-marketing.service";

interface RailInFlightProps {
  campaigns: PortfolioCampaign[];
}

function formatShortDate(iso: string | null): string | null {
  if (!iso) return null;
  // Render as UTC day so preview/server agree and timezone doesn't shift it.
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function RailInFlight({ campaigns }: RailInFlightProps) {
  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader>
        <CardTitle>
          <Film />
          <span>Campaigns</span>
        </CardTitle>
        <span className="text-[13px] font-normal text-text-tertiary normal-case tracking-normal">
          {campaigns.length} {campaigns.length === 1 ? "active" : "active"}
        </span>
      </CardHeader>

      {campaigns.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-text-primary font-medium">No active campaigns.</p>
          <p className="mt-1 text-sm text-text-secondary">
            The campaigns you own will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {campaigns.map((c) => {
            const nextShoot = formatShortDate(c.nextShootDate);
            const deliveryDate = formatShortDate(c.assetsDeliveryDate);
            const timingLabel = nextShoot
              ? `shoots ${nextShoot}`
              : deliveryDate
                ? `delivers ${deliveryDate}`
                : null;
            return (
              <li key={c.id}>
                <Link
                  href={`/brand-marketing/campaigns/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-text-tertiary">{c.wfNumber}</span>
                      <span className="text-sm font-medium text-text-primary truncate">
                        {c.name}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <LobChip lob={c.lineOfBusiness} />
                      {timingLabel && (
                        <span className="text-[11px] text-text-tertiary">{timingLabel}</span>
                      )}
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
