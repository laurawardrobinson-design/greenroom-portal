"use client";

import { useState } from "react";
import {
  List,
  AlignJustify,
  CalendarDays,
  FileText,
  Download,
} from "lucide-react";
import type { Shoot, CampaignDeliverable } from "@/types/domain";
import { ShotListCleanView } from "./shot-list-clean-view";
import { OneLinerView } from "./one-liner-view";
import { DayByDayView } from "./day-by-day-view";
import { CallSheetBuilder } from "./call-sheet-builder";

// ─── Sub-nav config ──────────────────────────────────────────────────────────
const SUB_VIEWS = [
  { id: "shot-list", label: "Shot List", icon: List },
  { id: "one-liner", label: "One-Liner", icon: AlignJustify },
  { id: "day-by-day", label: "Day-by-Day", icon: CalendarDays },
  { id: "call-sheet", label: "Call Sheet", icon: FileText },
] as const;

type SubViewId = (typeof SUB_VIEWS)[number]["id"];

interface ScheduleTabProps {
  campaignId: string;
  campaignName: string;
  wfNumber: string;
  assetsDeliveryDate: string | null;
  producerId: string | null;
  shoots: Shoot[];
  isArtDirector?: boolean;
  vendors: Array<{
    id: string;
    vendor?: {
      companyName: string;
      contactName: string;
      phone: string;
      email: string;
      category: string;
    };
  }>;
}

export function ScheduleTab({
  campaignId,
  campaignName,
  wfNumber,
  assetsDeliveryDate,
  producerId,
  shoots,
  isArtDirector,
  vendors,
}: ScheduleTabProps) {
  const [activeView, setActiveView] = useState<SubViewId>("shot-list");
  const visibleViews = isArtDirector
    ? SUB_VIEWS.filter((v) => v.id === "shot-list")
    : SUB_VIEWS;

  return (
    <div className="space-y-4">
      {/* Sub-navigation — compact pills, nested under main Schedule tab */}
      <div className="flex items-center gap-1.5">
        {visibleViews.map(({ id, label, icon: Icon }) => {
          const active = activeView === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveView(id)}
              className={`
                flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors
                ${active
                  ? "bg-primary/10 text-primary"
                  : "text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary"
                }
              `}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          );
        })}
      </div>

      {/* View content */}
      {activeView === "shot-list" && (
        <ShotListCleanView
          campaignId={campaignId}
          campaignName={campaignName}
          wfNumber={wfNumber}
          assetsDeliveryDate={assetsDeliveryDate}
          shoots={shoots}
        />
      )}

      {activeView === "one-liner" && (
        <OneLinerView
          campaignId={campaignId}
          campaignName={campaignName}
          wfNumber={wfNumber}
          shoots={shoots}
        />
      )}

      {activeView === "day-by-day" && (
        <DayByDayView
          campaignId={campaignId}
          campaignName={campaignName}
          wfNumber={wfNumber}
          shoots={shoots}
        />
      )}

      {activeView === "call-sheet" && (
        <CallSheetBuilder
          campaignId={campaignId}
          campaignName={campaignName}
          wfNumber={wfNumber}
          shoots={shoots}
          vendors={vendors}
          producerId={producerId}
        />
      )}
    </div>
  );
}
