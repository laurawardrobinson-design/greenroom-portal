"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import type { CampaignListItem, AppUser, BudgetRequest } from "@/types/domain";
import { CampaignStatusBadge } from "./campaign-status-badge";
import { formatCurrency } from "@/lib/utils/format";
import { useToast } from "@/components/ui/toast";
import { format, parseISO, differenceInDays } from "date-fns";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  campaign: CampaignListItem;
  onMutate?: () => void;
  hideFinancials?: boolean;
  readOnly?: boolean;
}

export function CampaignRow({ campaign, onMutate, hideFinancials, readOnly }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Date urgency
  const nextShootDays = campaign.nextShootDate
    ? differenceInDays(parseISO(campaign.nextShootDate), today)
    : null;
  const shootUrgent = nextShootDays !== null && nextShootDays >= 0 && nextShootDays <= 3;
  const assetsOverdue = campaign.assetsDeliveryDate
    ? parseISO(campaign.assetsDeliveryDate) < today
    : false;
  const hasUrgent = assetsOverdue || (nextShootDays !== null && nextShootDays <= 1 && nextShootDays >= 0);
  const hasWarning = shootUrgent && !hasUrgent;

  // Inline edit state
  const [editingProducer, setEditingProducer] = useState(false);
  const [editingAD, setEditingAD] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(
    campaign.productionBudget ? String(campaign.productionBudget) : ""
  );
  const [showFundsPopover, setShowFundsPopover] = useState(false);
  const fundsRef = useRef<HTMLDivElement>(null);
  const budgetInputRef = useRef<HTMLInputElement>(null);

  // Fetch users for dropdowns (SWR deduplicates across all rows)
  const { data: rawProducers } = useSWR<AppUser[]>(
    editingProducer ? "/api/users?roles=Producer,Admin" : null,
    fetcher
  );
  const producers = Array.isArray(rawProducers) ? rawProducers : null;
  const { data: rawArtDirectors } = useSWR<AppUser[]>(
    editingAD ? "/api/users?roles=Art%20Director,Admin" : null,
    fetcher
  );
  const artDirectors = Array.isArray(rawArtDirectors) ? rawArtDirectors : null;

  // Fetch budget requests when popover opens
  const { data: rawRequestsData } = useSWR<BudgetRequest[]>(
    showFundsPopover ? `/api/budget/requests?campaignId=${campaign.id}` : null,
    fetcher
  );
  const requestsData = Array.isArray(rawRequestsData) ? rawRequestsData : null;

  // Close funds popover on outside click
  useEffect(() => {
    if (!showFundsPopover) return;
    function handleClick(e: MouseEvent) {
      if (fundsRef.current && !fundsRef.current.contains(e.target as Node)) {
        setShowFundsPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showFundsPopover]);

  // Focus budget input when editing starts
  useEffect(() => {
    if (editingBudget) budgetInputRef.current?.select();
  }, [editingBudget]);

  async function patchCampaign(body: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const message = await res.text().catch(() => res.statusText);
        throw new Error(message || "Update failed");
      }
      onMutate?.();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Update failed");
    }
  }

  async function saveProducer(userId: string) {
    setEditingProducer(false);
    await patchCampaign({ producerId: userId || null });
  }

  async function saveAD(userId: string) {
    setEditingAD(false);
    await patchCampaign({ artDirectorId: userId || null });
  }

  async function saveBudget() {
    setEditingBudget(false);
    const raw = budgetInput.replace(/[^0-9.]/g, "");
    const value = parseFloat(raw);
    if (!isNaN(value) && value !== campaign.productionBudget) {
      await patchCampaign({ productionBudget: value });
    }
  }

  const hasFunds = (campaign.additionalFundsRequested ?? 0) > 0 || (campaign.additionalFundsApproved ?? 0) > 0;

  return (
    <div
      onClick={() => router.push(`/campaigns/${campaign.id}`)}
      className="flex items-center gap-4 border-b border-border bg-surface px-5 py-3 hover:bg-surface-secondary transition-colors cursor-pointer group last:border-b-0"
    >
      {/* Attention dot */}
      <div className="w-2.5 shrink-0 flex justify-center">
        {hasUrgent ? (
          <span className="h-2.5 w-2.5 rounded-full bg-error" />
        ) : hasWarning ? (
          <span className="h-2.5 w-2.5 rounded-full bg-warning" />
        ) : null}
      </div>

      {/* WF Number */}
      <div className="w-20 shrink-0">
        <span className="text-[10px] text-text-secondary">{campaign.wfNumber || "—"}</span>
      </div>

      {/* Campaign Name */}
      <div className="flex-1 min-w-[160px]">
        <span className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors truncate block">
          {campaign.name}
        </span>
      </div>

      {/* Producer */}
      <div
        className="w-28 shrink-0 hidden lg:block"
        onClick={readOnly ? undefined : (e) => { e.stopPropagation(); setEditingProducer(true); setEditingAD(false); }}
      >
        {editingProducer ? (
          <select
            autoFocus
            className="w-full text-xs border border-primary rounded px-1 py-0.5 bg-surface text-text-primary focus:outline-none"
            defaultValue={campaign.producerId ?? ""}
            onChange={(e) => saveProducer(e.target.value)}
            onBlur={() => setEditingProducer(false)}
          >
            <option value="">— none —</option>
            {(producers ?? []).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-text-secondary truncate block hover:text-primary transition-colors cursor-pointer">
            {campaign.producerName || <span className="text-text-tertiary italic">Add…</span>}
          </span>
        )}
      </div>

      {/* Art Director */}
      <div
        className="w-28 shrink-0 hidden lg:block"
        onClick={readOnly ? undefined : (e) => { e.stopPropagation(); setEditingAD(true); setEditingProducer(false); }}
      >
        {editingAD ? (
          <select
            autoFocus
            className="w-full text-xs border border-primary rounded px-1 py-0.5 bg-surface text-text-primary focus:outline-none"
            defaultValue={campaign.artDirectorId ?? ""}
            onChange={(e) => saveAD(e.target.value)}
            onBlur={() => setEditingAD(false)}
          >
            <option value="">— none —</option>
            {(artDirectors ?? []).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-text-secondary truncate block hover:text-primary transition-colors cursor-pointer">
            {campaign.artDirectorName || <span className="text-text-tertiary italic">Add…</span>}
          </span>
        )}
      </div>

      {/* Status */}
      <div className="w-20 shrink-0 hidden lg:block" onClick={(e) => e.stopPropagation()}>
        <CampaignStatusBadge status={campaign.status} />
      </div>

      {/* Next Shoot */}
      <div className="w-20 shrink-0 text-right hidden lg:block">
        <span className={`text-xs ${shootUrgent ? "text-error font-medium" : "text-text-secondary"}`}>
          {campaign.nextShootDate ? format(parseISO(campaign.nextShootDate), "MMM d") : "—"}
        </span>
      </div>

      {/* Assets Due */}
      <div className="w-20 shrink-0 text-right hidden lg:block">
        <span className={`text-xs ${assetsOverdue ? "text-error font-medium" : "text-text-secondary"}`}>
          {campaign.assetsDeliveryDate ? format(parseISO(campaign.assetsDeliveryDate), "MMM d") : "—"}
        </span>
      </div>

      {/* Inventory (vendor-only, replaces budget/funds columns) */}
      {hideFinancials && (
        <div className="w-36 shrink-0 text-right" onClick={(e) => e.stopPropagation()}>
          {(campaign.foodCount > 0 || campaign.propsCount > 0 || campaign.gearCount > 0) ? (
            <span className="text-xs text-text-secondary">
              {[
                campaign.foodCount > 0 ? `${campaign.foodCount} food` : null,
                campaign.propsCount > 0 ? `${campaign.propsCount} props` : null,
                campaign.gearCount > 0 ? `${campaign.gearCount} gear` : null,
              ].filter(Boolean).join(" · ")}
            </span>
          ) : (
            <span className="text-xs text-text-tertiary">—</span>
          )}
        </div>
      )}

      {/* Budget */}
      {!hideFinancials && (
      <div
        className="w-20 shrink-0 text-right"
        onClick={(e) => { e.stopPropagation(); setEditingBudget(true); }}
      >
        {editingBudget ? (
          <input
            ref={budgetInputRef}
            type="text"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            onBlur={saveBudget}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveBudget();
              if (e.key === "Escape") setEditingBudget(false);
            }}
            className="w-full text-xs text-right border border-primary rounded px-1 py-0.5 bg-surface text-text-primary focus:outline-none"
          />
        ) : (
          <span className="text-xs text-text-secondary hover:text-primary transition-colors cursor-pointer">
            {campaign.productionBudget ? formatCurrency(campaign.productionBudget) : <span className="text-text-tertiary italic">Set…</span>}
          </span>
        )}
      </div>
      )}

      {/* Additional Funds */}
      {!hideFinancials && (
      <div
        ref={fundsRef}
        className="w-28 shrink-0 text-right hidden lg:block relative"
        onClick={(e) => { e.stopPropagation(); if (hasFunds) setShowFundsPopover(!showFundsPopover); }}
      >
        {hasFunds ? (
          <div className={`space-y-0.5 cursor-pointer ${showFundsPopover ? "opacity-70" : ""}`}>
            {(campaign.additionalFundsRequested ?? 0) > 0 && (
              <span className="text-xs font-medium text-warning block">
                {formatCurrency(campaign.additionalFundsRequested)} pending
              </span>
            )}
            {(campaign.additionalFundsApproved ?? 0) > 0 && (
              <span className="text-xs font-medium text-success block">
                {formatCurrency(campaign.additionalFundsApproved)} approved
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-text-tertiary">—</span>
        )}

        {/* Popover */}
        {showFundsPopover && (
          <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-border bg-surface shadow-lg p-3 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Budget Requests</p>
            {!requestsData ? (
              <p className="text-xs text-text-tertiary">Loading…</p>
            ) : requestsData.length === 0 ? (
              <p className="text-xs text-text-tertiary">No requests found.</p>
            ) : (
              <div className="space-y-2">
                {requestsData.map((req) => (
                  <div key={req.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-text-primary truncate">{req.rationale || "No rationale"}</p>
                      <p className="text-[10px] text-text-tertiary">{req.requester?.name || "Unknown"}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-text-primary">{formatCurrency(req.amount)}</p>
                      <span className={`text-[10px] font-medium ${
                        req.status === "Approved" ? "text-success" :
                        req.status === "Declined" ? "text-error" :
                        "text-warning"
                      }`}>
                        {req.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
