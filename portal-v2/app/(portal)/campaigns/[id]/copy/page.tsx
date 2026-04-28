"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useCampaign } from "@/hooks/use-campaigns";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { CampaignDetailHeader } from "@/components/campaigns/campaign-detail-header";
import { CampaignSectionTabs } from "@/components/campaigns/campaign-section-tabs";
import { PageTabs } from "@/components/ui/page-tabs";
import { CopyTile } from "@/components/campaigns/tiles/copy-tile";
import { DeliverableCopyTile } from "@/components/campaigns/tiles/deliverable-copy-tile";
import { Type, LayoutTemplate } from "lucide-react";
import type { CampaignStatus } from "@/types/domain";

type Tab = "campaign" | "deliverable";

const COPY_TABS: Array<{ key: Tab; label: string; icon: React.ElementType }> = [
  { key: "campaign", label: "Campaign Copy", icon: Type },
  { key: "deliverable", label: "Per Deliverable", icon: LayoutTemplate },
];

export default function CampaignCopyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { campaign, deliverables, isLoading, mutate } = useCampaign(id);
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("campaign");

  const canEdit =
    user?.role === "Admin" ||
    user?.role === "Producer" ||
    user?.role === "Post Producer";
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
    } else {
      toast("error", "Failed to change status");
    }
  }

  async function handleDelete() {
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast("success", "Campaign deleted");
      router.push("/campaigns");
    } else {
      toast("error", "Failed to delete campaign");
    }
  }

  async function handleUpdate(field: string, value: string | number | null) {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      mutate();
    } else {
      toast("error", "Failed to update");
    }
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
        description="Campaign copy isn't available to vendors."
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

      <PageTabs
        ariaLabel="Copy sections"
        tabs={COPY_TABS.map(({ key, label }) => ({ key, label }))}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as Tab)}
      />

      <div className="pt-2">
        {activeTab === "campaign" ? (
          <CopyTile
            campaign={campaign}
            canEdit={canEdit}
            onUpdate={async (field, value) => {
              await handleUpdate(field, value);
            }}
          />
        ) : (
          <DeliverableCopyTile
            campaign={campaign}
            deliverables={deliverables}
            canEdit={canEdit}
            onMutate={mutate}
          />
        )}
      </div>
    </div>
  );
}
