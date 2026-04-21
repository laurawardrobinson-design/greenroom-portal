"use client";

import useSWR from "swr";
import Link from "next/link";
import { Film, Palette, ArrowUpRight, ListChecks } from "lucide-react";
import type { AppUser, Campaign } from "@/types/domain";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface MineResponse {
  items: Array<{ campaign: Campaign; roles: string[] }>;
}

function TileHeader({
  icon: Icon,
  title,
  trailing,
}: {
  icon: React.ElementType;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
        {title}
      </span>
      {trailing && <div className="ml-auto">{trailing}</div>}
    </div>
  );
}

export function DesignerDashboard({ user }: { user: AppUser }) {
  const { data, isLoading } = useSWR<MineResponse>("/api/campaigns/mine", fetcher);
  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-text-primary">
        Welcome back, {user.name?.split(" ")[0] || "there"}
      </h1>

      <Card padding="none" className="overflow-hidden">
        <TileHeader
          icon={Film}
          title="My Campaigns"
          trailing={
            <Link
              href="/asset-studio?tab=my_work"
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-tertiary hover:text-text-secondary"
            >
              <ListChecks className="h-3 w-3" />
              Open My Work
            </Link>
          }
        />
        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="space-y-3 px-3.5 py-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="px-3.5 py-8 text-center text-xs text-text-tertiary">
              No campaigns assigned yet. A Producer will add you as the primary designer when work is ready.
            </p>
          ) : (
            items.map(({ campaign, roles }) => (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}/asset-studio`}
                className="flex items-center gap-3 px-3.5 py-3 hover:bg-surface-secondary/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-text-primary">
                      {campaign.wfNumber ? `${campaign.wfNumber} · ` : ""}
                      {campaign.name}
                    </span>
                    <CampaignStatusBadge status={campaign.status} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-text-secondary">
                    {roles
                      .map((r) =>
                        r === "primary_designer"
                          ? "Primary Designer"
                          : r === "primary_art_director"
                            ? "Primary Art Director"
                            : r
                      )
                      .join(" · ")}
                    {campaign.assetsDeliveryDate && (
                      <> · Assets due {campaign.assetsDeliveryDate}</>
                    )}
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-text-tertiary" />
              </Link>
            ))
          )}
        </div>
      </Card>

      <Card padding="md" className="flex items-start gap-3">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Palette className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">Asset Studio</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            Browse all templates, see mechanicals in progress, and check urgent work in one place.
          </p>
          <Link
            href="/asset-studio"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            Open Asset Studio
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </Card>
    </div>
  );
}
