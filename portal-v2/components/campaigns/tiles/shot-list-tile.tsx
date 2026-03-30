"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShotListSpreadsheet } from "@/components/campaigns/shot-list-spreadsheet";
import { Crosshair, Plus } from "lucide-react";
import type { ShotListSetup, CampaignDeliverable } from "@/types/domain";

interface Props {
  campaignId: string;
  setups: ShotListSetup[];
  deliverables: CampaignDeliverable[];
  wfNumber?: string;
  firstShootDate?: string;
  canEditShots: boolean;
  canCompleteShots: boolean;
  onSetMode: boolean;
  onAddSetup: () => void;
  onMutate: () => void;
}

export function ShotListTile({
  campaignId,
  setups,
  deliverables,
  wfNumber,
  firstShootDate,
  canEditShots,
  canCompleteShots,
  onSetMode,
  onAddSetup,
  onMutate,
}: Props) {
  const allShots = setups.flatMap((s) => s.shots);
  const completedShots = allShots.filter((s) => s.status === "Complete").length;
  const totalShots = allShots.length;

  return (
    <Card padding="none">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 shrink-0 text-primary" />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">Shot List</h3>
            {totalShots > 0 && (
              <p className="text-[10px] text-text-tertiary">
                {completedShots}/{totalShots} complete
              </p>
            )}
          </div>
        </div>
        {canEditShots && setups.length > 0 && (
          <Button size="sm" variant="ghost" onClick={onAddSetup}>
            <Plus className="h-3.5 w-3.5" />
            Add Scene
          </Button>
        )}
      </div>

      {/* On-set progress bar */}
      {onSetMode && totalShots > 0 && (
        <div className="px-5 pt-3 pb-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-primary">Shot Progress</span>
            <span className="text-xs font-medium text-primary">{completedShots} of {totalShots}</span>
          </div>
          <div className="h-2.5 rounded-full bg-surface-tertiary overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${totalShots > 0 ? (completedShots / totalShots) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Spreadsheet */}
      <ShotListSpreadsheet
        setups={setups}
        deliverables={deliverables}
        campaignId={campaignId}
        wfNumber={wfNumber}
        firstShootDate={firstShootDate}
        canEdit={canEditShots}
        canComplete={canCompleteShots}
        onAddSetup={onAddSetup}
        onMutate={onMutate}
      />
    </Card>
  );
}
