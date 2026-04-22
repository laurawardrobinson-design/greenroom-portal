"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import type { AppUser } from "@/types/domain";
import type { BrandMarketingPortfolio } from "@/lib/services/brand-marketing.service";
import type { LineOfBusiness } from "@/lib/constants/lines-of-business";
import { PageHeader } from "@/components/ui/page-header";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { LobFilterChips } from "./lob-filter-chips";
import { RailInFlight } from "./rail-in-flight";
import { RailInMarket } from "./rail-in-market";
import { RailBriefHealth } from "./rail-brief-health";
import { RailFormalRequests } from "./rail-formal-requests";
import { RailInProgressRequests } from "./rail-in-progress-requests";

async function fetcher(url: string): Promise<BrandMarketingPortfolio> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Portfolio fetch failed: ${r.status}`);
  return r.json();
}

interface BrandMarketingHomeProps {
  user: AppUser;
}

export function BrandMarketingHome({ user }: BrandMarketingHomeProps) {
  const [lobFilter, setLobFilter] = useState<LineOfBusiness | null>(null);

  const url = lobFilter
    ? `/api/brand-marketing/portfolio?lob=${encodeURIComponent(lobFilter)}`
    : "/api/brand-marketing/portfolio";

  const { data: portfolio, isLoading } = useSWR<BrandMarketingPortfolio>(url, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  // When filter is empty we can compute "which LOBs does this user actually own?"
  // from the unfiltered response, so the chip row can show the real subset.
  const { data: unfilteredPortfolio } = useSWR<BrandMarketingPortfolio>(
    "/api/brand-marketing/portfolio",
    fetcher,
    { revalidateOnFocus: false }
  );

  const availableLobs = useMemo<LineOfBusiness[] | undefined>(() => {
    const inFlight = unfilteredPortfolio?.inFlight;
    if (!Array.isArray(inFlight)) return undefined;
    const set = new Set<LineOfBusiness>();
    for (const c of inFlight) {
      if (c.lineOfBusiness) set.add(c.lineOfBusiness);
    }
    return set.size > 0 ? Array.from(set) : undefined;
  }, [unfilteredPortfolio]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Brand Marketing — {user.name.split(" ")[0]}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Everything happening under the departments you own, in one view.
            </p>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <LobFilterChips
          value={lobFilter}
          onChange={setLobFilter}
          availableLobs={availableLobs}
        />
      </div>

      {isLoading && !portfolio ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <RailInFlight campaigns={portfolio?.inFlight ?? []} />
          <RailInMarket campaigns={portfolio?.nextInMarket ?? []} />
          <RailFormalRequests />
          <RailInProgressRequests />
          <div className="lg:col-span-2">
            <RailBriefHealth
              briefHealth={
                portfolio?.briefHealth ?? { total: 0, withBrief: 0, missing: [] }
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
