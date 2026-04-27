"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { useCampaigns } from "@/hooks/use-campaigns";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import type { CampaignListItem } from "@/types/domain";

const PREP_STATUSES: Array<CampaignListItem["status"]> = [
  "Planning",
  "In Production",
];

const LAST_CAMPAIGN_KEY = "last_preprod_campaign_id";

function readLastCampaignId(): string | null {
  try {
    return localStorage.getItem(LAST_CAMPAIGN_KEY);
  } catch {
    return null;
  }
}

export default function PreProductionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const { user, isLoading: userLoading } = useCurrentUser();
  const { campaigns, isLoading: campaignsLoading } = useCampaigns();

  const isLoading = userLoading || campaignsLoading;

  useEffect(() => {
    if (isLoading) return;

    const prep = campaigns.filter((c) => PREP_STATUSES.includes(c.status));
    if (prep.length === 0) return;

    const mine = prep.filter(
      (c) => c.producerIds.includes(user?.id ?? "") || c.createdBy === user?.id
    );
    const soonest = (list: CampaignListItem[]) =>
      [...list].sort((a, b) => {
        const aDate = a.nextShootDate ?? "9999-12-31";
        const bDate = b.nextShootDate ?? "9999-12-31";
        return aDate.localeCompare(bDate);
      });

    const lastId = readLastCampaignId();
    const lastStillValid = lastId && prep.some((c) => c.id === lastId);

    const targetId =
      (lastStillValid ? lastId : null) ??
      soonest(mine)[0]?.id ??
      soonest(prep)[0]?.id;

    if (!targetId) return;

    const nextPath = tab
      ? `/campaigns/${targetId}/pre-production?tab=${encodeURIComponent(tab)}`
      : `/campaigns/${targetId}/pre-production`;
    router.replace(nextPath);
  }, [isLoading, campaigns, user, tab, router]);

  if (isLoading) return <DashboardSkeleton />;

  const hasAnyPrep = campaigns.some((c) => PREP_STATUSES.includes(c.status));

  if (!hasAnyPrep) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Card padding="none">
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="No campaigns in pre-production"
            description="Campaigns with status Planning, Upcoming, or In Production will land you here automatically."
          />
        </Card>
      </div>
    );
  }

  // Redirect is firing — show skeleton while it settles.
  return <DashboardSkeleton />;
}
