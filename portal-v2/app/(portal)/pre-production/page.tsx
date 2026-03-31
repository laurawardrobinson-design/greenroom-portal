"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCampaigns } from "@/hooks/use-campaigns";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { ClipboardList } from "lucide-react";

export default function PreProductionPage() {
  const router = useRouter();
  const { user, isLoading: userLoading } = useCurrentUser();
  const { campaigns, isLoading: campaignsLoading } = useCampaigns();

  const isLoading = userLoading || campaignsLoading;

  const prepCampaigns = campaigns.filter(
    (c) => c.status === "Planning" || c.status === "In Production"
  );

  // Prefer campaigns assigned to this producer, fall back to any prep campaign
  const mine = prepCampaigns.filter(
    (c) => c.producerId === user?.id || c.createdBy === user?.id
  );
  const target = mine[0] ?? prepCampaigns[0];

  useEffect(() => {
    if (!isLoading && target) {
      router.replace(`/campaigns/${target.id}/pre-production`);
    }
  }, [isLoading, target, router]);

  if (isLoading || target) return <DashboardSkeleton />;

  // No pre-production campaigns
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-24 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
        <ClipboardList className="h-5 w-5 text-text-tertiary" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-secondary">No campaigns in pre-production</p>
        <p className="text-xs text-text-tertiary mt-0.5">
          Campaigns with Planning or In Production status will appear here.
        </p>
      </div>
    </div>
  );
}
