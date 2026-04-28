"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ShootDayBlock } from "@/components/studio/shoot-day-block";
import type { ShootMeal } from "@/types/domain";
import {
  Utensils,
  AlertCircle,
  Users,
  MapPin,
} from "lucide-react";
import { format, addDays } from "date-fns";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

interface CampaignGroup {
  campaignId: string;
  campaignName: string;
  wfNumber: string;
  days: Map<string, ShootMeal[]>;
}

type TimeRange = "upcoming" | "past";
type DateFilter = "all" | "this-week" | "next-week";
type StatusFilter = "all" | "pending";
type LocationFilter = "all" | "greenroom" | "outside";

interface FoodViewProps {
  userRole: string;
}

export function FoodView({ userRole }: FoodViewProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("upcoming");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");

  const now = new Date();
  const dateFrom = timeRange === "upcoming"
    ? format(now, "yyyy-MM-dd")
    : format(addDays(now, -60), "yyyy-MM-dd");
  const dateTo = timeRange === "upcoming"
    ? format(addDays(now, 60), "yyyy-MM-dd")
    : format(now, "yyyy-MM-dd");
  const locationParam = locationFilter !== "all" ? `&location=${locationFilter}` : "";

  const { data: meals, isLoading, mutate: refreshMeals } = useSWR<ShootMeal[]>(
    `/api/shoot-meals?dateFrom=${dateFrom}&dateTo=${dateTo}${locationParam}`,
    fetcher
  );

  // Apply filters
  const filteredMeals = useMemo(() => {
    let result = meals ?? [];

    if (statusFilter === "pending") {
      result = result.filter((m) => m.status === "pending");
    }

    if (timeRange === "upcoming") {
      if (dateFilter === "this-week") {
        const weekEnd = format(addDays(now, 7), "yyyy-MM-dd");
        result = result.filter((m) => m.shootDate <= weekEnd);
      } else if (dateFilter === "next-week") {
        const weekStart = format(addDays(now, 7), "yyyy-MM-dd");
        const weekEnd = format(addDays(now, 14), "yyyy-MM-dd");
        result = result.filter((m) => m.shootDate >= weekStart && m.shootDate <= weekEnd);
      }
    }

    return result;
  }, [meals, statusFilter, dateFilter, timeRange]);

  // Group by campaign → shoot date
  const campaignGroups = useMemo<CampaignGroup[]>(() => {
    const map = new Map<string, CampaignGroup>();
    filteredMeals.forEach((m) => {
      const cg = map.get(m.campaignId) ?? {
        campaignId: m.campaignId,
        campaignName: m.campaign?.name ?? "Unknown",
        wfNumber: m.campaign?.wfNumber ?? "",
        days: new Map(),
      };
      const dayMeals = cg.days.get(m.shootDate) ?? [];
      dayMeals.push(m);
      cg.days.set(m.shootDate, dayMeals);
      map.set(m.campaignId, cg);
    });
    map.forEach((cg) => {
      cg.days = new Map([...cg.days.entries()].sort(([a], [b]) => a.localeCompare(b)));
    });
    return [...map.values()].sort((a, b) => {
      const aFirst = a.days.keys().next().value ?? "";
      const bFirst = b.days.keys().next().value ?? "";
      return (aFirst as string).localeCompare(bFirst as string);
    });
  }, [filteredMeals]);

  const totalPending = (meals ?? []).filter((m) => m.status === "pending").length;
  const uniqueHeadcounts = (meals ?? [])
    .filter((m) => m.mealType !== "crafty" && m.headcount)
    .map((m) => m.headcount as number);
  const maxHeadcount = uniqueHeadcounts.length ? Math.max(...uniqueHeadcounts) : 0;
  const hasDietary = (meals ?? []).some((m) => m.dietaryNotes);

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      {(meals ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {totalPending > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-warning">
              <AlertCircle className="h-3 w-3" />
              {totalPending} pending
            </div>
          )}
          {maxHeadcount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-secondary px-3 py-1 text-xs font-medium text-text-secondary">
              <Users className="h-3 w-3" />
              Up to {maxHeadcount} crew
            </div>
          )}
          {hasDietary && (
            <div className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-error">
              <AlertCircle className="h-3 w-3" />
              Dietary restrictions on file
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Time range toggle */}
        <div className="flex gap-1 rounded-xl bg-surface-secondary p-1">
          {([
            { id: "upcoming" as TimeRange, label: "Upcoming" },
            { id: "past" as TimeRange, label: "Past 60 Days" },
          ]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => { setTimeRange(id); setDateFilter("all"); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                timeRange === id
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date sub-filter (only for upcoming) */}
        {timeRange === "upcoming" && (
          <div className="flex gap-1 rounded-xl bg-surface-secondary p-1">
            {([
              { id: "all" as DateFilter, label: "All" },
              { id: "this-week" as DateFilter, label: "This Week" },
              { id: "next-week" as DateFilter, label: "Next Week" },
            ]).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setDateFilter(id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  dateFilter === id
                    ? "bg-surface text-text-primary shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Status filter */}
        <div className="flex gap-1 rounded-xl bg-surface-secondary p-1">
          {([
            { id: "all" as StatusFilter, label: "All Status" },
            { id: "pending" as StatusFilter, label: "Pending Only" },
          ]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setStatusFilter(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === id
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Location filter */}
        <div className="flex gap-1 rounded-xl bg-surface-secondary p-1">
          {([
            { id: "all" as LocationFilter, label: "All Locations" },
            { id: "greenroom" as LocationFilter, label: "Greenroom" },
            { id: "outside" as LocationFilter, label: "Outside" },
          ]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setLocationFilter(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                locationFilter === id
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {id === "greenroom" && <MapPin className="h-3 w-3" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-surface-secondary animate-pulse" />
          ))}
        </div>
      ) : campaignGroups.length === 0 ? (
        <EmptyState
          icon={<Utensils className="h-5 w-5" />}
          title={timeRange === "past" ? "No meals in the past 60 days" : "No meals in this range"}
          description="Add meals from the campaign pre-production page or from shoot day blocks."
        />
      ) : (
        <div className="space-y-8">
          {campaignGroups.map((group) => (
            <div key={group.campaignId} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-text-primary">
                  {[group.wfNumber, group.campaignName].filter(Boolean).join(" ")}
                </h3>
                <div className="flex-1 h-px bg-border" />
              </div>

              {[...group.days.entries()].map(([date, dayMeals]) => (
                <ShootDayBlock
                  key={date}
                  campaignId={group.campaignId}
                  campaignName={group.campaignName}
                  wfNumber={group.wfNumber}
                  shootDate={date}
                  meals={dayMeals}
                  userRole={userRole}
                  onRefresh={() => refreshMeals()}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
