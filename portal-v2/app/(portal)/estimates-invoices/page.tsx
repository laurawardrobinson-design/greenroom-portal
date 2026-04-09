"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCampaigns } from "@/hooks/use-campaigns";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText } from "lucide-react";

export default function EstimatesInvoicesPage() {
  const router = useRouter();
  const { user, isLoading: loadingUser } = useCurrentUser();
  const { campaigns, isLoading: loadingCampaigns } = useCampaigns();

  const isLoading = loadingUser || loadingCampaigns;
  const canAccess = user?.role === "Admin" || user?.role === "Producer";

  const prepCampaigns = campaigns.filter(
    (campaign) =>
      campaign.status === "Planning" ||
      campaign.status === "Upcoming" ||
      campaign.status === "In Production"
  );

  const mine = prepCampaigns.filter(
    (campaign) => campaign.producerId === user?.id || campaign.createdBy === user?.id
  );
  const target = mine[0] ?? prepCampaigns[0];

  useEffect(() => {
    if (!isLoading && canAccess && target) {
      router.replace(`/campaigns/${target.id}/pre-production?tab=payments`);
    }
  }, [isLoading, canAccess, target, router]);

  if (isLoading || (canAccess && target)) return <DashboardSkeleton />;

  if (!canAccess) {
    return (
      <EmptyState
        title="Access restricted"
        description="Estimates & Invoices is available to Producers and Admins."
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-24 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
        <FileText className="h-5 w-5 text-text-tertiary" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-secondary">No campaigns ready for estimates or invoices</p>
        <p className="mt-0.5 text-xs text-text-tertiary">
          Assign a vendor to a campaign and workflow actions will appear in Payments.
        </p>
      </div>
    </div>
  );
}
