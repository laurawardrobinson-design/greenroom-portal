"use client";

import { useState } from "react";
import { Type, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CopyTile } from "./copy-tile";
import { DeliverableCopyTile } from "./deliverable-copy-tile";
import type { Campaign, CampaignDeliverable } from "@/types/domain";

interface Props {
  campaign: Campaign;
  deliverables: CampaignDeliverable[];
  canEdit: boolean;
  onUpdate: (field: string, value: string) => Promise<void>;
  onMutate: () => void;
}

export function CopySectionTile({ campaign, deliverables, canEdit, onUpdate, onMutate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"campaign" | "deliverable">("campaign");

  return (
    <Card padding="none">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <Type className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
          Copy
        </span>
        {expanded && (
          <div className="ml-3 flex items-center gap-1">
            {(["campaign", "deliverable"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  tab === t
                    ? "bg-primary text-white"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                {t === "campaign" ? "Campaign" : "Per Deliverable"}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-tertiary hover:text-text-primary"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse copy" : "Expand copy"}
        >
          <span>{expanded ? "Hide" : "Show"}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>
      {expanded && (
        <>
          {tab === "campaign" && (
            <CopyTile
              campaign={campaign}
              canEdit={canEdit}
              onUpdate={onUpdate}
              bare
            />
          )}
          {tab === "deliverable" && (
            <DeliverableCopyTile
              campaign={campaign}
              deliverables={deliverables}
              canEdit={canEdit}
              onMutate={onMutate}
              bare
            />
          )}
        </>
      )}
    </Card>
  );
}
