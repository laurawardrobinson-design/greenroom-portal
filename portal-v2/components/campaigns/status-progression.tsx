"use client";

import type { CampaignStatus } from "@/types/domain";
import { CAMPAIGN_STATUS_ORDER } from "@/lib/constants/statuses";
import { Check } from "lucide-react";
import { validateStatusTransition } from "@/lib/services/campaigns.validation";

interface Props {
  status: CampaignStatus;
  onStatusChange?: (status: CampaignStatus) => void;
  disabled?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  Planning: "bg-slate-400",
  "In Production": "bg-blue-500",
  Post: "bg-purple-500",
  Complete: "bg-emerald-500",
};

export function StatusProgression({ status, onStatusChange, disabled }: Props) {
  const currentIndex = CAMPAIGN_STATUS_ORDER.indexOf(status);
  const isCancelled = status === "Cancelled";

  const handleStatusClick = (newStatus: CampaignStatus) => {
    if (!onStatusChange) return;

    // Validate the transition
    const validation = validateStatusTransition(status, newStatus);
    if (!validation.valid) {
      // Don't allow invalid transitions - button should be disabled anyway
      return;
    }

    onStatusChange(newStatus);
  };

  return (
    <div className="flex items-center gap-0">
      {CAMPAIGN_STATUS_ORDER.map((s, i) => {
        const isPast = !isCancelled && i < currentIndex;
        const isCurrent = !isCancelled && i === currentIndex;
        const isFuture = isCancelled || i > currentIndex;

        // Validate if this status can be clicked
        const canTransition = !disabled && onStatusChange && !isCurrent &&
          validateStatusTransition(status, s).valid;
        const isClickable = canTransition;

        return (
          <div key={s} className="flex items-center">
            {i > 0 && (
              <div
                className={`h-px w-5 sm:w-8 transition-colors ${
                  isPast ? STATUS_COLORS[s] || "bg-slate-300" : "bg-border"
                }`}
              />
            )}
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && handleStatusClick(s)}
              className={`group relative flex items-center justify-center rounded-full transition-all ${
                isCurrent
                  ? `h-7 w-7 ${STATUS_COLORS[s]} text-white shadow-sm`
                  : isPast
                  ? `h-5 w-5 ${STATUS_COLORS[s]} text-white`
                  : `h-5 w-5 border-2 border-border bg-surface`
              } ${
                isClickable
                  ? "cursor-pointer hover:ring-2 hover:ring-primary/30 hover:scale-110"
                  : "cursor-default"
              }`}
              title={s}
            >
              {isPast && <Check className="h-3 w-3" strokeWidth={3} />}
              {isCurrent && (
                <span className="text-[10px] font-bold leading-none">
                  {i + 1}
                </span>
              )}

              {/* Tooltip */}
              <span
                className={`absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium transition-opacity ${
                  isCurrent
                    ? "text-text-primary opacity-100"
                    : "text-text-tertiary opacity-0 group-hover:opacity-100"
                }`}
              >
                {s}
              </span>
            </button>
          </div>
        );
      })}

      {isCancelled && (
        <div className="ml-3 rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-semibold text-red-600">
          Cancelled
        </div>
      )}
    </div>
  );
}
