"use client";

import useSWR from "swr";
import Link from "next/link";
import { format, parseISO, addDays } from "date-fns";
import type { AppUser, PostWorkflowSummary } from "@/types/domain";
import { Card } from "@/components/ui/card";
import {
  Clapperboard,
  HardDrive,
  Clock,
  AlertTriangle,
  CheckSquare,
  CalendarDays,
  ChevronRight,
} from "lucide-react";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

interface Props {
  user: AppUser;
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  href,
  alert,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
  href?: string;
  alert?: boolean;
}) {
  const inner = (
    <div className="flex items-start justify-between min-h-[4.5rem]">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">{label}</p>
        <p className={`mt-1.5 text-2xl font-semibold tracking-tight ${alert && Number(value) > 0 ? "text-red-600" : "text-text-primary"}`}>
          {value}
        </p>
      </div>
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        <Card className="hover:border-primary/40 transition-colors cursor-pointer">{inner}</Card>
      </Link>
    );
  }
  return <Card>{inner}</Card>;
}

export function PostProducerDashboard({ user }: Props) {
  const { data: summary } = useSWR<PostWorkflowSummary>(
    "/api/post-workflow/summary",
    fetcher
  );

  // Fetch this week's edit room reservations
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const weekEndStr = format(addDays(new Date(), 6), "yyyy-MM-dd");
  const { data: weekReservations } = useSWR<any[]>(
    `/api/post-workflow/edit-room-reservations?from=${todayStr}&to=${weekEndStr}`,
    fetcher
  );

  const reservations = Array.isArray(weekReservations) ? weekReservations : [];

  // Deduplicate by group_id for display
  const uniqueGroupIds = new Set<string>();
  const weekBookings = reservations.filter((r) => {
    if (uniqueGroupIds.has(r.groupId)) return false;
    uniqueGroupIds.add(r.groupId);
    return true;
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-text-primary">
        Welcome back, {user.name.split(" ")[0]}
      </h2>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Edit Rooms Today"
          value={summary ? summary.editRoomsBookedToday : "—"}
          icon={Clapperboard}
          accent="bg-violet-50 text-violet-600"
          href="/post-workflow?tab=edit-rooms"
        />
        <StatCard
          label="Drives Out"
          value={summary ? summary.drivesCheckedOut : "—"}
          icon={HardDrive}
          accent="bg-blue-50 text-blue-600"
          href="/post-workflow?tab=drives"
        />
        <StatCard
          label="Pending Backup / Wipe"
          value={summary ? summary.drivesPendingBackup : "—"}
          icon={Clock}
          accent="bg-amber-50 text-amber-600"
          href="/post-workflow?tab=drives"
        />
        <StatCard
          label="Flagged Drives"
          value={summary ? summary.drivesNearingRetirement + summary.drivesPastRetirement : "—"}
          icon={AlertTriangle}
          accent={
            summary && summary.drivesPastRetirement > 0
              ? "bg-red-50 text-red-600"
              : "bg-orange-50 text-orange-500"
          }
          href="/post-workflow?tab=drives"
          alert
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Retirement Alerts */}
        <Card padding="none">
          <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Drive Retirement Alerts
            </h3>
          </div>
          <div className="p-3">
            {!summary || summary.retirementAlerts.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-sm text-text-tertiary">
                <CheckSquare className="h-4 w-4 text-emerald-500" />
                All drives are within their retirement window.
              </div>
            ) : (
              <div className="space-y-2">
                {summary.retirementAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                      alert.pastRetirement
                        ? "bg-red-50 border border-red-200"
                        : "bg-orange-50 border border-orange-200"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${alert.pastRetirement ? "text-red-700" : "text-orange-700"}`}>
                        {alert.brand} {alert.model ?? ""} · {alert.storageSize}
                      </p>
                      <p className={`text-xs ${alert.pastRetirement ? "text-red-500" : "text-orange-500"}`}>
                        {alert.pastRetirement
                          ? `Retired ${format(parseISO(alert.retirementDate), "MMM d, yyyy")}`
                          : `Retires ${format(parseISO(alert.retirementDate), "MMM d, yyyy")}`}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        alert.pastRetirement
                          ? "bg-red-100 text-red-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {alert.pastRetirement ? "Past Retirement" : "Retiring Soon"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* This week's edit bookings */}
        <Card padding="none">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                Edit Room Bookings — This Week
              </h3>
            </div>
            <Link
              href="/post-workflow?tab=edit-rooms"
              className="flex items-center gap-1 text-xs text-text-tertiary transition-colors hover:text-primary"
            >
              View all
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-3">
            {weekBookings.length === 0 ? (
              <p className="py-4 text-sm text-text-tertiary">No edit room bookings this week.</p>
            ) : (
              <div className="space-y-2">
                {weekBookings.slice(0, 8).map((r) => (
                  <div
                    key={r.groupId}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-secondary transition-colors"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700">
                      <Clapperboard className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {r.roomName ?? r.roomId}
                      </p>
                      <p className="truncate text-xs text-text-secondary">
                        {r.editorName}
                        {r.campaignWfNumber ? ` · ${r.campaignWfNumber}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-text-tertiary">
                      {format(parseISO(r.reservedDate), "MMM d")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
