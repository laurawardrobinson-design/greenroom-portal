"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowUpRight } from "lucide-react";
import type { AppUser } from "@/types/domain";
import type { BrandMarketingPortfolio } from "@/lib/services/brand-marketing.service";
import type { LineOfBusiness } from "@/lib/constants/lines-of-business";
import { PR_DEPARTMENT_LABELS } from "@/types/domain";
import { PageHeader } from "@/components/ui/page-header";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { LobFilterChips } from "./lob-filter-chips";
import { RailInFlight } from "./rail-in-flight";
import { RailInMarket } from "./rail-in-market";
import { RailBriefHealth } from "./rail-brief-health";
import { RailFormalRequests } from "./rail-formal-requests";
import { RailUpcomingShoots } from "./rail-upcoming-shoots";
import { RailRbuAgenda } from "./rail-rbu-agenda";

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

  const deskLabel = user.deskDepartment
    ? PR_DEPARTMENT_LABELS[user.deskDepartment]
    : null;

  return (
    <div className="space-y-4">
      <div className="space-y-0">
        <PageHeader title={`Welcome back, ${user.name.split(" ")[0]}`} />
        <LobFilterChips
          value={lobFilter}
          onChange={setLobFilter}
          availableLobs={availableLobs}
        />
      </div>

      {isLoading && !portfolio ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Horizon 1 — Imminent shoots (next 2 business weeks) */}
          <HorizonSection eyebrow="Next 2 weeks" title="Shoots coming up">
            <RailUpcomingShoots />
          </HorizonSection>

          {/* Horizon 2 — Incoming requests awaiting BMM review */}
          <HorizonSection eyebrow="Now" title="Request inbox">
            <RailFormalRequests />
          </HorizonSection>

          {/* Horizon 3 — RBU weekly-meeting agenda */}
          <HorizonSection
            eyebrow="Next few months"
            title="RBU weekly agenda"
            action={
              <Link
                href={
                  user.deskDepartment
                    ? `/brand-marketing/review/${user.deskDepartment}`
                    : "/brand-marketing/review"
                }
                className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary-hover transition-colors"
              >
                Review products by department
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            <RailRbuAgenda />
          </HorizonSection>

          {/* Portfolio context — secondary, but useful for a pulse check */}
          <HorizonSection eyebrow="Portfolio" title="Your campaigns">
            <div className="grid gap-6 lg:grid-cols-2">
              <RailInFlight campaigns={portfolio?.inFlight ?? []} />
              <RailInMarket campaigns={portfolio?.nextInMarket ?? []} />
            </div>
            <div className="mt-6">
              <RailBriefHealth
                briefHealth={
                  portfolio?.briefHealth ?? { total: 0, withBrief: 0, missing: [] }
                }
              />
            </div>
          </HorizonSection>
        </>
      )}
    </div>
  );
}

function HorizonSection({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
          {eyebrow}
        </p>
        <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          {action}
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}
