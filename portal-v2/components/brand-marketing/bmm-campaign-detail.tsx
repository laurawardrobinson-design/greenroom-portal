"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useCampaign } from "@/hooks/use-campaigns";
import { PageHeader } from "@/components/ui/page-header";
import { BriefEditor } from "@/components/campaigns/brief-editor";
import { InventoryTile } from "@/components/campaigns/tiles/inventory-tile";
import { LinkProductDrawer } from "@/components/campaigns/link-product-drawer";
import { BmmPrSection } from "@/components/brand-marketing/bmm-pr-section";
import type { AppUser } from "@/types/domain";

interface Props {
  campaignId: string;
  user: AppUser;
}

export function BmmCampaignDetail({ campaignId, user: _user }: Props) {
  const { campaign, campaignProducts, campaignGear, isLoading, mutate } = useCampaign(campaignId);
  const [showAddProduct, setShowAddProduct] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-48 rounded bg-surface-secondary" />
        <div className="h-4 w-72 rounded bg-surface-secondary" />
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
          <div className="h-96 rounded-lg bg-surface-secondary" />
          <div className="h-64 rounded-lg bg-surface-secondary" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return <p className="text-sm text-text-tertiary">Campaign not found.</p>;
  }

  const title = [campaign.wfNumber, campaign.name].filter(Boolean).join(" ");

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="Campaigns"
        breadcrumbHref="/brand-marketing/campaigns"
        title={title}
        showDivider={false}
      />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-start">
        {/* Left — Brief + Products */}
        <div className="space-y-4">
          <BriefEditor campaignId={campaignId} canEdit={true} />

          <InventoryTile
            campaignProducts={campaignProducts}
            campaignGear={campaignGear}
            canEdit={false}
            onlyTab="products"
            hideTeamNotes={true}
            onAddProduct={() => setShowAddProduct(true)}
            onAddProps={() => {}}
            onAddGear={() => {}}
            onMutate={mutate}
            headerAction={
              <button
                type="button"
                onClick={() => setShowAddProduct(true)}
                className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            }
          />
        </div>

        {/* Right — Product requests panel */}
        <BmmPrSection campaignId={campaignId} />
      </div>

      <LinkProductDrawer
        open={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        campaignId={campaignId}
        onLinked={() => {
          setShowAddProduct(false);
          mutate();
        }}
      />
    </div>
  );
}
