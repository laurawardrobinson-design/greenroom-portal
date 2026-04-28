"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useCampaign } from "@/hooks/use-campaigns";
import { PageHeader } from "@/components/ui/page-header";
import { BriefEditor } from "@/components/campaigns/brief-editor";
import { InventoryTile } from "@/components/campaigns/tiles/inventory-tile";
import { LinkProductDrawer } from "@/components/campaigns/link-product-drawer";
import { BmmPrSection } from "@/components/brand-marketing/bmm-pr-section";
import type { AppUser, CampaignListItem } from "@/types/domain";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  campaignId: string;
  user: AppUser;
}

export function BmmCampaignDetail({ campaignId, user }: Props) {
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
    <div className="space-y-4">
      <PageHeader
        title={title}
        stackActionsOnMobile={false}
        actions={
          <BmmCampaignSwitcher
            currentId={campaignId}
            currentName={campaign.name}
            currentWf={campaign.wfNumber}
            userId={user.id}
          />
        }
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

function BmmCampaignSwitcher({
  currentId,
  userId,
}: {
  currentId: string;
  currentName: string;
  currentWf?: string | null;
  userId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: owned = [] } = useSWR<CampaignListItem[]>(
    `/api/campaigns?ownedBy=${userId}`,
    fetcher
  );
  const { data: all = [] } = useSWR<CampaignListItem[]>(
    open && showAll ? "/api/campaigns" : null,
    fetcher
  );

  const displayed = showAll || owned.length === 0 ? all : owned;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
      >
        Switch campaign
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-surface shadow-lg z-50 overflow-hidden">
          {owned.length > 0 && (
            <div className="flex border-b border-border">
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${!showAll ? "text-primary bg-primary/5" : "text-text-tertiary hover:text-text-secondary"}`}
              >
                My Campaigns
              </button>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className={`flex-1 px-4 py-2 text-xs font-medium border-l border-border transition-colors ${showAll ? "text-primary bg-primary/5" : "text-text-tertiary hover:text-text-secondary"}`}
              >
                All
              </button>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto">
            {displayed.length === 0 ? (
              <p className="px-4 py-3 text-xs text-text-tertiary">No campaigns</p>
            ) : (
              displayed.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(`/brand-marketing/campaigns/${c.id}`);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-secondary transition-colors"
                >
                  <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
                    {c.wfNumber && (
                      <span className="text-base text-text-primary shrink-0">{c.wfNumber}</span>
                    )}
                    <span className="text-base text-text-primary truncate">{c.name}</span>
                  </div>
                  {c.id === currentId && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
