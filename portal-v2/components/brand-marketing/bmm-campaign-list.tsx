"use client";

import { useEffect, useState } from "react";
import { Film, LayoutGrid, List, Plus, Search, Upload, Eye, Cookie, Sandwich, Apple, Beef, ShoppingBasket, type LucideIcon } from "lucide-react";
import { useCampaigns } from "@/hooks/use-campaigns";
import type { AppUser, CampaignStatus, LineOfBusiness } from "@/types/domain";
import { LINES_OF_BUSINESS } from "@/types/domain";

const LOB_ICONS: Record<LineOfBusiness, LucideIcon> = {
  Bakery: Cookie,
  Deli: Sandwich,
  Produce: Apple,
  "Meat & Seafood": Beef,
  Grocery: ShoppingBasket,
};

// LOB label → PR department enum value (PRs use "Meat-Seafood" hyphenated).
const LOB_TO_PR_DEPT: Record<LineOfBusiness, string> = {
  Bakery: "Bakery",
  Deli: "Deli",
  Produce: "Produce",
  "Meat & Seafood": "Meat-Seafood",
  Grocery: "Grocery",
};
import { CampaignCard } from "@/components/campaigns/campaign-card";
import { CampaignRow } from "@/components/campaigns/campaign-row";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { CsvImportModal } from "@/components/campaigns/csv-import-modal";
import { NewCampaignModal } from "@/components/campaigns/new-campaign-modal";

interface Props {
  user: AppUser;
}

export function BmmCampaignList({ user }: Props) {
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "">("");
  const [lobFilter, setLobFilter] = useState<LineOfBusiness | "">("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("bmm-campaigns-view") as "grid" | "table") || "table";
    }
    return "table";
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { campaigns, isLoading, mutate } = useCampaigns({
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
  });

  // Department filter overrides "My campaigns" scope. Driven by PR contents:
  // a campaign appears under a department if any of its PRs has items in that dept.
  const displayedCampaigns = lobFilter
    ? campaigns.filter((c) => c.prDepartments.includes(LOB_TO_PR_DEPT[lobFilter]))
    : showAll
    ? campaigns
    : campaigns.filter(
        (c) =>
          c.brandOwnerId === user.id ||
          c.createdBy === user.id ||
          c.producerIds.includes(user.id) ||
          c.artDirectorId === user.id
      );

  function toggleView(mode: "grid" | "table") {
    setViewMode(mode);
    localStorage.setItem("bmm-campaigns-view", mode);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Campaigns"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button onClick={() => setShowNewCampaign(true)} className="rounded-full px-5">
              <Plus className="h-4 w-4" />
              New Campaign
            </Button>
          </div>
        }
      />

      {/* Filters row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search by name or Workfront ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-surface pl-11 pr-4 text-sm text-text-primary placeholder:text-text-tertiary shadow-xs focus:border-primary/20 focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | "")}
          className="h-11 rounded-xl border border-border bg-surface px-4 text-sm text-text-primary focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="Planning">Planning</option>
          <option value="In Production">In Production</option>
          <option value="Post">Post</option>
          <option value="Complete">Complete</option>
        </select>

        <button
          onClick={() => setShowAll(!showAll)}
          className={`flex items-center gap-1.5 rounded-xl px-4 h-11 text-sm font-medium transition-colors whitespace-nowrap ${
            showAll
              ? "bg-primary/10 text-primary"
              : "text-text-secondary hover:text-text-primary hover:bg-surface-secondary border border-border"
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
          {showAll ? "All campaigns" : "Show all"}
        </button>

        <div className="flex rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => toggleView("grid")}
            className={`h-11 w-11 flex items-center justify-center transition-colors ${
              viewMode === "grid"
                ? "bg-surface-secondary text-text-primary"
                : "bg-surface text-text-tertiary hover:text-text-secondary"
            }`}
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => toggleView("table")}
            className={`h-11 w-11 flex items-center justify-center border-l border-border transition-colors ${
              viewMode === "table"
                ? "bg-surface-secondary text-text-primary"
                : "bg-surface text-text-tertiary hover:text-text-secondary"
            }`}
            title="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Department filter */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {LINES_OF_BUSINESS.map((lob) => {
          const Icon = LOB_ICONS[lob];
          const active = lobFilter === lob;
          return (
            <button
              key={lob}
              type="button"
              onClick={() => setLobFilter(active ? "" : lob)}
              title={lob}
              aria-label={lob}
              className={`h-28 w-28 flex flex-col items-center justify-center gap-2 rounded-2xl border transition-colors ${
                active
                  ? "border-primary text-primary bg-primary/5"
                  : "border-border text-text-secondary hover:text-text-primary hover:bg-surface-secondary"
              }`}
            >
              <Icon className="h-7 w-7 text-primary" />
              <span className="text-sm font-medium leading-none">{lob === "Meat & Seafood" ? "Meat" : lob}</span>
            </button>
          );
        })}
      </div>

      {/* Campaign grid/table */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : displayedCampaigns.length === 0 ? (
        <EmptyState
          icon={<Film className="h-5 w-5" />}
          title={
            search || statusFilter
              ? "No campaigns match your filters"
              : showAll
              ? "No campaigns yet"
              : "No campaigns assigned to you"
          }
          description={
            search || statusFilter
              ? "Try adjusting your search or status filter."
              : showAll
              ? "Create your first campaign to get started."
              : "Try showing all campaigns or create a new one."
          }
          action={
            !search && !statusFilter ? (
              <Button size="sm" onClick={() => setShowNewCampaign(true)}>
                <Plus className="h-3.5 w-3.5" />
                New Campaign
              </Button>
            ) : undefined
          }
        />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayedCampaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              hideFinancials
              href={`/brand-marketing/campaigns/${campaign.id}`}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden bg-surface border border-border shadow-xs">
          <div className="flex items-center gap-4 px-5 py-1.5 text-sm font-semibold uppercase tracking-wider text-text-primary border-b border-border">
            <div className="w-2.5 shrink-0" />
            <div className="w-20 shrink-0">WF#</div>
            <div className="flex-1 min-w-[160px]">Campaign</div>
            <div className="w-28 shrink-0 hidden lg:block">Producer</div>
            <div className="w-28 shrink-0 hidden lg:block">Art Director</div>
            <div className="w-20 shrink-0 hidden lg:block">Status</div>
            <div className="w-20 shrink-0 text-right whitespace-nowrap hidden lg:block">Next Shoot</div>
            <div className="w-20 shrink-0 text-right hidden lg:block">Due</div>
          </div>
          {displayedCampaigns.map((campaign) => (
            <CampaignRow key={campaign.id} campaign={campaign} onMutate={mutate} hideFinancials />
          ))}
        </div>
      )}

      <NewCampaignModal
        open={showNewCampaign}
        onClose={() => setShowNewCampaign(false)}
        onCreated={() => {
          setShowNewCampaign(false);
          mutate();
        }}
      />
      <CsvImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => mutate()}
      />
    </div>
  );
}
