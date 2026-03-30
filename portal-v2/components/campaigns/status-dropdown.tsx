"use client";

import { useState, useRef, useEffect } from "react";
import type { CampaignStatus } from "@/types/domain";
import { CAMPAIGN_STATUS_ORDER } from "@/lib/constants/statuses";
import { useToast } from "@/components/ui/toast";
import { ChevronDown, Ban } from "lucide-react";

interface Props {
  status: CampaignStatus;
  onStatusChange?: (status: CampaignStatus) => void;
  disabled?: boolean;
}

const PILL_COLORS: Record<CampaignStatus, { bg: string; text: string; dot: string }> = {
  Planning: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" },
  "In Production": { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  Post: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  Complete: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  Cancelled: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-400" },
};

export function StatusDropdown({ status, onStatusChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const colors = PILL_COLORS[status];
  const canChange = !disabled && onStatusChange;

  function handleSelect(newStatus: CampaignStatus) {
    if (newStatus === status) return;
    const previousStatus = status;
    onStatusChange?.(newStatus);
    setOpen(false);
    toast("success", `Changed to ${newStatus}`, {
      label: "Undo",
      onClick: () => onStatusChange?.(previousStatus),
    });
  }

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => canChange && setOpen(!open)}
        disabled={!canChange}
        className={`
          inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium
          transition-all duration-150
          ${colors.bg} ${colors.text}
          ${canChange ? "cursor-pointer hover:shadow-sm active:scale-[0.97]" : "cursor-default"}
        `}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
        {status}
        {canChange && (
          <ChevronDown className={`h-3 w-3 opacity-50 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-30 w-48 rounded-xl border border-border bg-surface shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="p-1">
            {CAMPAIGN_STATUS_ORDER.map((s) => {
              const itemColors = PILL_COLORS[s];
              const isActive = s === status;
              const isDisabled = false;

              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => !isDisabled && handleSelect(s)}
                  disabled={isDisabled}
                  className={`
                    flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-base transition-colors
                    ${isActive ? "bg-surface-secondary font-medium" : ""}
                    ${isDisabled ? "opacity-35 cursor-not-allowed" : "hover:bg-surface-secondary cursor-pointer"}
                  `}
                >
                  <span className={`h-2 w-2 rounded-full ${itemColors.dot}`} />
                  <span className={isActive ? "text-text-primary" : "text-text-secondary"}>
                    {s}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Cancelled — separated */}
          {status !== "Cancelled" && (
            <>
              <div className="border-t border-border" />
              <div className="p-1">
                <button
                  type="button"
                  onClick={() => handleSelect("Cancelled")}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-base text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                >
                  <Ban className="h-3 w-3" />
                  Cancel Campaign
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
