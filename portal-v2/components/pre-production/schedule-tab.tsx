"use client";

import { useState } from "react";
import type { Shoot } from "@/types/domain";
import { ShotListCleanView } from "./shot-list-clean-view";
import { OneLinerView } from "./one-liner-view";
import { CallSheetBuilder } from "./call-sheet-builder";

// ─── Sub-nav config ──────────────────────────────────────────────────────────
export const SCHEDULE_SUB_VIEWS = [
  { id: "shot-list", label: "Shot List" },
  { id: "one-liner", label: "One-Liner" },
  { id: "call-sheet", label: "Call Sheet" },
] as const;

export type ScheduleSubViewId = (typeof SCHEDULE_SUB_VIEWS)[number]["id"];

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
  activeView?: ScheduleSubViewId;
  onActiveViewChange?: (view: ScheduleSubViewId) => void;
  showViewSwitcher?: boolean;
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
  activeView: activeViewProp,
  onActiveViewChange,
  showViewSwitcher = true,
}: ScheduleTabProps) {
  const [internalActiveView, setInternalActiveView] = useState<ScheduleSubViewId>("shot-list");
  const isControlled = activeViewProp !== undefined;
  const activeView = isControlled ? activeViewProp : internalActiveView;
  const visibleViews = isArtDirector
    ? SCHEDULE_SUB_VIEWS.filter((v) => v.id === "shot-list")
    : SCHEDULE_SUB_VIEWS;
  const resolvedActiveView = visibleViews.some((view) => view.id === activeView)
    ? activeView
    : visibleViews[0].id;

  function handleViewChange(viewId: ScheduleSubViewId) {
    if (!isControlled) {
      setInternalActiveView(viewId);
    }
    onActiveViewChange?.(viewId);
  }

  return (
    <div className="pl-[var(--density-schedule-offset-x)]">
      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        {showViewSwitcher && (
          <div className="border-b border-border bg-surface-secondary/55 px-[var(--density-schedule-panel-pad-x)] py-[var(--density-schedule-panel-pad-y)]">
            <div className="inline-flex items-center gap-[var(--density-subnav-gap)] rounded-lg bg-surface-secondary/70 p-1">
              {visibleViews.map(({ id, label }) => {
                const active = resolvedActiveView === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleViewChange(id)}
                    className={`
                      rounded-md px-[var(--density-subnav-pill-px)] py-[var(--density-subnav-pill-py)] text-xs font-medium transition-colors
                      ${active
                        ? "bg-surface text-text-primary shadow-xs"
                        : "text-text-tertiary hover:bg-surface/70 hover:text-text-secondary"
                      }
                    `}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Window body: selected subview */}
        <div className="p-[var(--density-schedule-panel-content-pad)]">
          {resolvedActiveView === "shot-list" && (
            <ShotListCleanView
              campaignId={campaignId}
              campaignName={campaignName}
              wfNumber={wfNumber}
              assetsDeliveryDate={assetsDeliveryDate}
              shoots={shoots}
              embedded
            />
          )}

          {resolvedActiveView === "one-liner" && (
            <OneLinerView
              campaignId={campaignId}
              campaignName={campaignName}
              wfNumber={wfNumber}
              shoots={shoots}
            />
          )}

          {resolvedActiveView === "call-sheet" && (
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
      </section>
    </div>
  );
}
