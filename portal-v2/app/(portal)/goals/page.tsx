"use client";

import { useState } from "react";
import useSWR from "swr";
import { formatDistanceToNow, parseISO, differenceInMonths } from "date-fns";
import { useCurrentUser } from "@/hooks/use-current-user";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Search, Compass, MessageCircle } from "lucide-react";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

interface GoalOverviewUser {
  id: string;
  name: string;
  role: string;
  title: string;
  favoritePublixProduct: string;
  goal: {
    id: string;
    goalText: string;
    currentRoleContext: string;
    updatedAt: string;
    lastActivityAt?: string;
    adviceCount: number;
    milestones?: { total: number; completed: number };
    isStakeholder?: boolean;
  } | null;
}

const ROLE_BADGE: Record<string, string> = {
  Admin: "bg-purple-50 text-purple-700",
  Producer: "bg-blue-50 text-blue-700",
  Studio: "bg-teal-50 text-teal-700",
  "Art Director": "bg-amber-50 text-amber-700",
};

const FILTER_ROLES = ["Producer", "Studio", "Art Director"] as const;

export default function GoalsPage() {
  const { user } = useCurrentUser();
  const { data, isLoading } = useSWR<GoalOverviewUser[]>("/api/goals", fetcher);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  if (!user || user.role === "Vendor") return null;

  const users = data ?? [];

  // Apply filters
  const filtered = users.filter((u) => {
    if (search) {
      const q = search.toLowerCase();
      const matchName = u.name.toLowerCase().includes(q);
      const matchGoal = u.goal?.goalText.toLowerCase().includes(q);
      if (!matchName && !matchGoal) return false;
    }
    if (roleFilter && u.role !== roleFilter) return false;
    return true;
  });

  const withGoals = filtered.filter((u) => u.goal);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Team Goals</h2>
        <p className="text-sm text-text-secondary">
          See what the team is growing toward and offer advice
        </p>
      </div>

      {/* Search + filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or goal..."
            className="w-full h-10 rounded-lg border border-border bg-surface pl-10 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setRoleFilter("")}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              !roleFilter
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-text-secondary hover:text-text-primary hover:border-text-tertiary"
            }`}
          >
            All
          </button>
          {FILTER_ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(roleFilter === r ? "" : r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                roleFilter === r
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-text-secondary hover:text-text-primary hover:border-text-tertiary"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Results */}
      {!isLoading && (
        <>
          {withGoals.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                  Goals in Progress
                </span>
                <span className="text-[10px] text-text-tertiary">{withGoals.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {withGoals.map((u) => (
                  <GoalCard key={u.id} user={u} />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Compass className="h-5 w-5" />}
              title="No goals found"
              description={search || roleFilter ? "Try adjusting your search or filters." : "No one has set a goal yet."}
            />
          )}
        </>
      )}
    </div>
  );
}

function GoalCard({ user: u }: { user: GoalOverviewUser }) {
  if (!u.goal) return null;

  const isStale = u.goal.lastActivityAt
    ? differenceInMonths(new Date(), parseISO(u.goal.lastActivityAt)) >= 3
    : false;

  return (
    <Card hover padding="none">
      <div className="p-4 space-y-3">
        {/* Header: Avatar + name + stale indicator */}
        <div className="flex items-start gap-3">
          <div className="relative">
            <UserAvatar name={u.name} favoriteProduct={u.favoritePublixProduct} size="sm" />
            {isStale && u.goal.isStakeholder && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400" title="No activity in 3+ months" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">{u.name}</p>
            <p className="text-xs text-text-secondary truncate">{u.title || u.role}</p>
          </div>
          <Badge variant="custom" className={ROLE_BADGE[u.role] || "bg-gray-50 text-gray-700"}>
            {u.role}
          </Badge>
        </div>

        {/* Goal text */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Compass className="h-3 w-3 text-primary shrink-0" />
            <p className="text-xs font-medium text-primary">Growing toward</p>
          </div>
          <p className="text-sm text-text-primary line-clamp-2">{u.goal.goalText}</p>
          {u.goal.currentRoleContext && (
            <p className="text-[10px] text-text-tertiary">
              Currently: {u.goal.currentRoleContext}
            </p>
          )}
        </div>

        {/* Progress bar — only visible to stakeholders */}
        {u.goal.isStakeholder && u.goal.milestones && u.goal.milestones.total > 0 && (
          <ProgressBar
            completed={u.goal.milestones.completed}
            total={u.goal.milestones.total}
          />
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            {u.goal.adviceCount > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-text-tertiary">
                <MessageCircle className="h-3 w-3" />
                {u.goal.adviceCount}
              </div>
            )}
          </div>
          <span className="text-[10px] text-text-tertiary ml-auto">
            {formatDistanceToNow(parseISO(u.goal.updatedAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    </Card>
  );
}
