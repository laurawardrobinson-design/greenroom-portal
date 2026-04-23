"use client";

import { useState, useRef, useEffect } from "react";
import type { CampaignStatus } from "@/types/domain";
import {
  CAMPAIGN_STATUS_ORDER,
  campaignStatusStyle,
} from "@/lib/constants/statuses";
import { useToast } from "@/components/ui/toast";
import { ChevronDown, Ban } from "lucide-react";

interface Props {
  status: CampaignStatus;
  onStatusChange?: (status: CampaignStatus) => void;
  disabled?: boolean;
}

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

  const pillStyle = campaignStatusStyle(status);
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
        style={pillStyle}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-all duration-150 ${
          canChange
            ? "cursor-pointer hover:shadow-sm active:scale-[0.97]"
            : "cursor-default"
        }`}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: pillStyle.color }}
        />
        {status}
        {canChange && (
          <ChevronDown
            className={`h-3 w-3 opacity-50 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-30 w-48 rounded-xl border border-border bg-surface shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="p-1">
            {CAMPAIGN_STATUS_ORDER.map((s) => {
              const itemStyle = campaignStatusStyle(s);
              const isActive = s === status;

              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSelect(s)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-base transition-colors cursor-pointer hover:bg-surface-secondary ${
                    isActive ? "bg-surface-secondary font-medium" : ""
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: itemStyle.color }}
                  />
                  <span
                    className={isActive ? "text-text-primary" : "text-text-secondary"}
                  >
                    {s}
                  </span>
                </button>
              );
            })}
          </div>

          {status !== "Cancelled" && (
            <>
              <div className="border-t border-border" />
              <div className="p-1">
                <button
                  type="button"
                  onClick={() => handleSelect("Cancelled")}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-base text-error cursor-pointer transition-colors hover:bg-error/5"
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
