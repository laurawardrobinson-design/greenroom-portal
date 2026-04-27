"use client";

import { useState } from "react";
import { Film, Plus, Eye } from "lucide-react";
import useSWR from "swr";
import type { AppUser, CampaignListItem } from "@/types/domain";
import { CampaignCard } from "@/components/campaigns/campaign-card";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  user: AppUser;
}

export function BmmCampaignList({ user }: Props) {
  const [showAll, setShowAll] = useState(false);

  const { data: owned = [], isLoading: loadingOwned } = useSWR<CampaignListItem[]>(
    `/api/campaigns?ownedBy=${user.id}`,
    fetcher
  );
  const { data: all = [], isLoading: loadingAll } = useSWR<CampaignListItem[]>(
    showAll ? "/api/campaigns" : null,
    fetcher
  );

  const campaigns = showAll ? all : owned;
  const isLoading = showAll ? loadingAll : loadingOwned;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-border">
        <h1 className="text-2xl font-bold text-text-primary">Campaigns</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className={`flex items-center gap-1.5 rounded-xl px-4 h-11 text-sm font-medium transition-colors whitespace-nowrap ${
              showAll
                ? "bg-primary/10 text-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-secondary border border-border"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            {showAll ? "All campaigns" : "My campaigns"}
          </button>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-1.5 rounded-full px-5 h-11 text-sm font-semibold text-white bg-primary hover:bg-primary-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Campaign
          </Link>
        </div>
      </div>

      {/* Campaign grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={<Film className="h-5 w-5" />}
          title={showAll ? "No campaigns yet" : "No campaigns assigned to you"}
          description={
            showAll
              ? "Create the first campaign to get started."
              : "Switch to all campaigns to browse existing ones, or create a new one."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              hideFinancials
              href={`/brand-marketing/campaigns/${c.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
