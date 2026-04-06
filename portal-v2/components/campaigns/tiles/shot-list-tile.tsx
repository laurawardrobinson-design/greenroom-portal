"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShotListSpreadsheet } from "@/components/campaigns/shot-list-spreadsheet";
import { Crosshair } from "lucide-react";
import type { ShotListSetup, CampaignDeliverable, CampaignStatus, CampaignProduct } from "@/types/domain";

interface Props {
  campaignId: string;
  setups: ShotListSetup[];
  deliverables: CampaignDeliverable[];
  campaignProducts?: CampaignProduct[];
  wfNumber?: string;
  firstShootDate?: string;
  canEditShots: boolean;
  canCompleteShots: boolean;
  onSetMode: boolean;
  campaignStatus: CampaignStatus;
  onAddSetup: () => void;
  onMutate: () => void;
}

export function ShotListTile({
  campaignId,
  setups,
  deliverables,
  campaignProducts = [],
  wfNumber,
  firstShootDate,
  canEditShots,
  canCompleteShots,
  onSetMode,
  campaignStatus,
  onAddSetup,
  onMutate,
}: Props) {
  const router = useRouter();
  return (
    <Card padding="none">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 shrink-0 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">One-Liner</h3>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-text-secondary hover:text-text-primary"
          onClick={() => router.push(`/campaigns/${campaignId}/pre-production`)}
        >
          View Full Shot List
        </Button>
      </div>

      {/* Spreadsheet */}
      <ShotListSpreadsheet
        setups={setups}
        deliverables={deliverables}
        campaignProducts={campaignProducts}
        campaignId={campaignId}
        wfNumber={wfNumber}
        firstShootDate={firstShootDate}
        canEdit={canEditShots}
        canComplete={canCompleteShots}
        campaignStatus={campaignStatus}
        onAddSetup={onAddSetup}
        onMutate={onMutate}
      />
    </Card>
  );
}
