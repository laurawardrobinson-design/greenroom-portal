"use client";

import useSWR from "swr";
import type { AppUser } from "@/types/domain";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/format";
import { DollarSign, AlertTriangle, Calendar, TrendingUp } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  user: AppUser;
}

function StatCard({
  label, value, icon: Icon, accent,
}: {
  label: string; value: string; icon: React.ElementType; accent: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-text-primary">{value}</p>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </Card>
  );
}

export function HopDashboard({ user }: Props) {
  const { data: stats } = useSWR("/api/dashboard", fetcher);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          Welcome back, {user.name.split(" ")[0]}
        </h2>
        <p className="text-sm text-text-secondary">
          Here&apos;s your production overview
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Budget"
          value={stats ? formatCurrency(stats.totalBudget) : "—"}
          icon={DollarSign}
          accent="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Committed"
          value={stats ? formatCurrency(stats.committed) : "—"}
          icon={TrendingUp}
          accent="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Pending Approvals"
          value={stats ? String(stats.pendingApprovals) : "—"}
          icon={AlertTriangle}
          accent="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Shoots This Week"
          value={stats ? String(stats.shootsThisWeek) : "—"}
          icon={Calendar}
          accent="bg-purple-50 text-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
            <Link href="/budget">
              <Button variant="ghost" size="sm">View all</Button>
            </Link>
          </CardHeader>
          {stats?.pendingApprovals > 0 ? (
            <p className="text-sm text-text-secondary">
              {stats.pendingApprovals} item{stats.pendingApprovals !== 1 ? "s" : ""} need your review.
            </p>
          ) : (
            <EmptyState
              title="No pending approvals"
              description="Budget requests, overages, and invoices that need your review will appear here."
            />
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Shoots</CardTitle>
            <Link href="/calendar">
              <Button variant="ghost" size="sm">View calendar</Button>
            </Link>
          </CardHeader>
          {stats?.shootsThisWeek > 0 ? (
            <p className="text-sm text-text-secondary">
              {stats.shootsThisWeek} shoot{stats.shootsThisWeek !== 1 ? "s" : ""} scheduled this week.
            </p>
          ) : (
            <EmptyState
              title="No upcoming shoots"
              description="Scheduled shoot days across all campaigns will appear here."
            />
          )}
        </Card>
      </div>
    </div>
  );
}
