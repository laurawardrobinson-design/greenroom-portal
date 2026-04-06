"use client";

import { useState, useEffect } from "react";
import { useCampaigns } from "@/hooks/use-campaigns";
import { useCurrentUser } from "@/hooks/use-current-user";
import { CampaignCard } from "@/components/campaigns/campaign-card";
import { CampaignRow } from "@/components/campaigns/campaign-row";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import type { CampaignStatus } from "@/types/domain";
import { CsvImportModal } from "@/components/campaigns/csv-import-modal";
import { NewCampaignModal } from "@/components/campaigns/new-campaign-modal";
import { Plus, Film, Search, Upload, LayoutGrid, List, Eye } from "lucide-react";

export default function CampaignsPage() {
  const { user } = useCurrentUser();
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "">("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("campaigns-view") as "grid" | "table") || "table";
    }
    return "table";
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { campaigns, isLoading, mutate } = useCampaigns({
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
  });

  const canCreate = user?.role === "Admin" || user?.role === "Producer";

  // Default to "My Campaigns" — toggle to show all
  const displayedCampaigns = !showAll && user
    ? campaigns.filter((c) => c.createdBy === user.id || c.producerId === user.id || c.artDirectorId === user.id)
    : campaigns;

  function toggleView(mode: "grid" | "table") {
    setViewMode(mode);
    localStorage.setItem("campaigns-view", mode);
  }

  return (
    <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Campaigns</h1>
            <p className="text-sm text-text-secondary mt-1">Manage and track all production projects.</p>
          </div>
          {canCreate && (
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
          )}
        </div>

        {/* Filters row — compact */}
        <div className="flex items-center gap-3">
          {/* Status dropdown */}
          {/* Search — full width, spacious */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search by name or Workfront ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-surface pl-11 pr-4 text-sm text-text-primary placeholder:text-text-tertiary shadow-xs focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | "")}
            className="h-11 rounded-xl border border-border bg-surface px-4 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All statuses</option>
            <option value="Planning">Planning</option>
            <option value="Upcoming">Upcoming</option>
            <option value="In Production">In Production</option>
            <option value="Post">Post</option>
            <option value="Complete">Complete</option>
          </select>

          {/* Show all toggle */}
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

          {/* View toggle */}
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
                ? canCreate
                  ? "Create your first campaign to get started."
                  : "Campaigns will appear here."
                : "Try showing all campaigns or create a new one."
            }
            action={
              canCreate && !search && !statusFilter ? (
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
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden bg-surface border border-border shadow-xs">
            <div className="flex items-center gap-4 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border">
              <div className="w-2.5 shrink-0" />
              <div className="w-24 shrink-0">WF#</div>
              <div className="flex-1">Campaign</div>
              <div className="w-24 shrink-0 hidden lg:block">Producer</div>
              <div className="w-24 shrink-0 hidden lg:block">Art Director</div>
              <div className="w-28 shrink-0">Status</div>
              <div className="w-24 shrink-0 text-right">Next Shoot</div>
              <div className="w-24 shrink-0 text-right hidden lg:block">Assets Due</div>
              <div className="w-20 shrink-0 text-right">Budget</div>
              <div className="w-24 shrink-0 text-right hidden lg:block">Add&apos;l Funds</div>
            </div>
            {displayedCampaigns.map((campaign) => (
              <CampaignRow key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}

      {/* Modals */}
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
