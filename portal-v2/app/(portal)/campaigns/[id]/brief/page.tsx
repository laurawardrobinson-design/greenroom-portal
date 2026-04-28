"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useCampaign } from "@/hooks/use-campaigns";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { CampaignDetailHeader } from "@/components/campaigns/campaign-detail-header";
import { CampaignSectionTabs } from "@/components/campaigns/campaign-section-tabs";
import { BriefEditor } from "@/components/campaigns/brief-editor";
import type { CampaignStatus } from "@/types/domain";

export default function CampaignBriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { campaign, isLoading, mutate } = useCampaign(id);
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const canEdit =
    user?.role === "Admin" ||
    user?.role === "Producer" ||
    user?.role === "Post Producer";
  const canEditBrief = canEdit || user?.role === "Brand Marketing Manager";
  const canDelete = canEdit;
  const isVendor = user?.role === "Vendor";

  async function handleStatusChange(newStatus: CampaignStatus) {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      toast("success", `Status changed to ${newStatus}`);
      mutate();
    } else toast("error", "Failed to change status");
  }

  async function handleDelete() {
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast("success", "Campaign deleted");
      router.push("/campaigns");
    } else toast("error", "Failed to delete campaign");
  }

  async function handleUpdate(field: string, value: string | number | null) {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) mutate();
    else toast("error", "Failed to update");
  }

  if (isLoading) return <DashboardSkeleton />;
  if (!campaign) {
    return (
      <EmptyState
        title="Campaign not found"
        description="This campaign may have been deleted or you don't have access."
      />
    );
  }
  if (isVendor) {
    return (
      <EmptyState
        title="Not available"
        description="The campaign brief isn't available to vendors."
      />
    );
  }

  return (
    <div className="space-y-4">
      <CampaignDetailHeader
        campaign={campaign}
        canEdit={canEdit}
        canDelete={canDelete}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        deleting={false}
        onUpdate={handleUpdate}
      />
      <CampaignSectionTabs campaignId={id} />
      <div className="pt-2">
        <BriefEditor campaignId={id} canEdit={canEditBrief} />
      </div>
    </div>
  );
}
