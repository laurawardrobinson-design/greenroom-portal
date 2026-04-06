"use client";

import useSWR from "swr";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  Palette,
  Calendar,
  Clock,
  Film,
  Target,
  TrendingUp,
} from "lucide-react";
import type { AppUser, CampaignStatus } from "@/types/domain";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import { HighlightsCard } from "@/components/dashboard/highlights-card";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ── Types ────────────────────────────────────────────────────────────────────

interface ArtDirectorStats {
  activeBookings: number;
  activeBookingsList: {
    id: string;
    campaignId: string;
    campaignName: string;
    wfNumber: string;
    campaignStatus: string;
    role: string;
    dayRate: number;
    status: string;
  }[];
  upcomingShoots: number;
  upcomingShootsList: {
    bookingId: string;
    campaignName: string;
    wfNumber: string;
    shootDate: string;
    confirmed: boolean | null;
  }[];
  assetsDueSoon: number;
  shotProgress: {
    campaignId: string;
    campaignName: string;
    totalSetups: number;
    totalShots: number;
    completedShots: number;
  }[];
  goal: {
    goalText: string;
    milestonesCompleted: number;
    milestonesTotal: number;
  } | null;
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | undefined;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            {label}
          </p>
          <span className="mt-1.5 block text-2xl font-semibold tracking-tight text-text-primary">
            {value === undefined ? <Skeleton className="h-6 w-10" /> : value}
          </span>
        </div>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </Card>
  );
}

// ── Tile Header ──────────────────────────────────────────────────────────────

function TileHeader({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
        {title}
      </span>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export function ArtDirectorDashboard({ user }: { user: AppUser }) {
  const { data: stats } = useSWR<ArtDirectorStats>("/api/dashboard", fetcher);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary">
          Welcome back, {user.name?.split(" ")[0] || "there"}
        </h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Here&apos;s your creative overview
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Active Bookings"
          value={stats ? String(stats.activeBookings) : undefined}
          icon={Palette}
          accent="bg-purple-50 text-purple-600"
        />
        <StatCard
          label="Upcoming Shoots"
          value={stats ? String(stats.upcomingShoots) : undefined}
          icon={Calendar}
          accent="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Assets Due Soon"
          value={stats ? String(stats.assetsDueSoon) : undefined}
          icon={Clock}
          accent="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Main Grid: Content + Sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-7">
          {/* My Campaigns */}
          <div className="rounded-2xl border border-border bg-surface shadow-xs overflow-hidden">
            <TileHeader icon={Film} title="My Campaigns" />
            <div className="divide-y divide-border">
              {!stats ? (
                <div className="px-3.5 py-3 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-lg" />
                  ))}
                </div>
              ) : stats.activeBookingsList.length === 0 ? (
                <p className="px-3.5 py-6 text-center text-xs text-text-tertiary">
                  No active campaign assignments
                </p>
              ) : (
                stats.activeBookingsList.map((b) => (
                  <Link
                    key={b.id}
                    href={`/campaigns/${b.campaignId}`}
                    className="flex items-center gap-3 px-3.5 py-3 hover:bg-surface-secondary/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {b.campaignName}
                      </p>
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        {b.wfNumber} &middot; {b.role}
                      </p>
                    </div>
                    <CampaignStatusBadge
                      status={b.campaignStatus as CampaignStatus}
                    />
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Shoots */}
          <div className="rounded-2xl border border-border bg-surface shadow-xs overflow-hidden">
            <TileHeader icon={Calendar} title="Upcoming Shoots" />
            <div className="divide-y divide-border">
              {!stats ? (
                <div className="px-3.5 py-3 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 rounded-lg" />
                  ))}
                </div>
              ) : stats.upcomingShootsList.length === 0 ? (
                <p className="px-3.5 py-6 text-center text-xs text-text-tertiary">
                  No shoots in the next two weeks
                </p>
              ) : (
                stats.upcomingShootsList.map((s, i) => (
                  <div
                    key={`${s.bookingId}-${s.shootDate}-${i}`}
                    className="flex items-center gap-3 px-3.5 py-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-secondary text-center">
                      <span className="text-[10px] font-medium uppercase text-text-tertiary leading-none">
                        {format(parseISO(s.shootDate), "MMM")}
                      </span>
                      <span className="text-sm font-semibold text-text-primary leading-tight">
                        {format(parseISO(s.shootDate), "d")}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {s.campaignName}
                      </p>
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        {s.wfNumber}
                      </p>
                    </div>
                    {s.confirmed === true && (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        Confirmed
                      </span>
                    )}
                    {s.confirmed === null && (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        Pending
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Creative Progress */}
          <div className="rounded-2xl border border-border bg-surface shadow-xs overflow-hidden">
            <TileHeader icon={Target} title="Creative Progress" />
            <div className="divide-y divide-border">
              {!stats ? (
                <div className="px-3.5 py-3 space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-lg" />
                  ))}
                </div>
              ) : stats.shotProgress.length === 0 ? (
                <p className="px-3.5 py-6 text-center text-xs text-text-tertiary">
                  No shot lists yet
                </p>
              ) : (
                stats.shotProgress.map((sp) => {
                  const pct =
                    sp.totalShots > 0
                      ? Math.round((sp.completedShots / sp.totalShots) * 100)
                      : 0;
                  return (
                    <Link
                      key={sp.campaignId}
                      href={`/campaigns/${sp.campaignId}/shots`}
                      className="block px-3.5 py-3 hover:bg-surface-secondary/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {sp.campaignName}
                        </p>
                        <span className="shrink-0 text-[11px] text-text-secondary ml-2">
                          {sp.completedShots}/{sp.totalShots} shots
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-surface-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-[10px] font-medium text-text-tertiary w-7 text-right">
                          {pct}%
                        </span>
                      </div>
                      <p className="text-[10px] text-text-tertiary mt-1">
                        {sp.totalSetups} {sp.totalSetups === 1 ? "setup" : "setups"}
                      </p>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6 lg:col-span-3">
          {/* Growth Goal */}
          <div className="rounded-2xl border border-border bg-surface shadow-xs overflow-hidden">
            <TileHeader icon={TrendingUp} title="Growth Goal" />
            <div className="px-3.5 py-3">
              {!stats ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-2/3 rounded" />
                </div>
              ) : !stats.goal ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-text-tertiary mb-2">
                    No goal set yet
                  </p>
                  <Link
                    href="/goals"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Set your growth goal
                  </Link>
                </div>
              ) : (
                <>
                  <p className="text-sm text-text-primary leading-relaxed">
                    {stats.goal.goalText}
                  </p>
                  {stats.goal.milestonesTotal > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                          Milestones
                        </span>
                        <span className="text-[11px] text-text-secondary">
                          {stats.goal.milestonesCompleted} of{" "}
                          {stats.goal.milestonesTotal}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{
                            width: `${Math.round(
                              (stats.goal.milestonesCompleted /
                                stats.goal.milestonesTotal) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Highlights */}
          <HighlightsCard />
        </div>
      </div>
    </div>
  );
}
