"use client";

import useSWR from "swr";
import type { AppUser } from "@/types/domain";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { HighlightsCard } from "@/components/dashboard/highlights-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { FloorPlan } from "@/components/studio/floor-plan";
import { Package, Calendar, AlertCircle, QrCode, ArrowRight, Clock, MapPin, Map, Wrench, Users } from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  user: AppUser;
}

export function StudioDashboard({ user }: Props) {
  const { data: stats } = useSWR("/api/dashboard", fetcher);

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const { data: shoots, isLoading: loadingShoots } = useSWR(
    `/api/calendar?from=${today}`,
    fetcher
  );

  const { data: checkouts, isLoading: loadingCheckouts } = useSWR(
    "/api/gear?status=Checked+Out",
    fetcher
  );

  const { data: reservations } = useSWR(
    "/api/gear/reservations?upcoming=true",
    fetcher
  );

  const { data: spaces } = useSWR("/api/studio/spaces", fetcher);
  const { data: studioReservations } = useSWR(
    `/api/studio/reservations?dateFrom=${today}&dateTo=${today}`,
    fetcher
  );

  // Filter shoots to upcoming only (today or later)
  const allUpcoming = Array.isArray(shoots)
    ? shoots.filter((s: { date: string }) => s.date >= today)
    : [];
  const todayShoots = allUpcoming.filter((s: { date: string }) => s.date === today);
  const upcomingShoots = allUpcoming.slice(0, 5);

  const activeCheckouts = Array.isArray(checkouts) ? checkouts : [];
  const upcomingReservations = Array.isArray(reservations) ? reservations.slice(0, 5) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
        </div>
        <Link href="/gear/scan">
          <Button size="md" variant="secondary">
            <QrCode className="h-4 w-4" />
            Scan Gear
          </Button>
        </Link>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Calendar className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-tertiary">
                Upcoming Shoots
              </p>
              <p className="text-xl font-semibold text-text-primary">
                {stats?.upcomingShoots ?? "—"}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Package className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-tertiary">
                Gear Checked Out
              </p>
              <p className="text-xl font-semibold text-text-primary">
                {stats?.gearCheckedOut ?? "—"}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-500">
              <AlertCircle className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-tertiary">
                Overdue Returns
              </p>
              <p className="text-xl font-semibold text-text-primary">
                {stats?.overdueReturns ?? "—"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Today's Shoots — map left, campaigns right */}
      <Card padding="none" className="border-l-4 border-l-primary">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Map className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Today&apos;s Shoots
            </span>
          </div>
          <Link href="/studio">
            <Button variant="ghost" size="sm">
              Manage
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <div className="flex flex-col lg:flex-row">
          {/* Map — left */}
          <div className="lg:w-2/5 p-3 pointer-events-none select-none border-b lg:border-b-0 lg:border-r border-border">
            {Array.isArray(spaces) && Array.isArray(studioReservations) ? (
              <FloorPlan
                spaces={spaces}
                reservations={studioReservations}
                onRoomClick={() => {}}
              />
            ) : (
              <div className="flex items-center justify-center h-32 text-text-tertiary text-sm">
                Loading map…
              </div>
            )}
          </div>
          {/* Campaigns — right */}
          <div className="lg:w-3/5 p-3.5 flex flex-col">
            {todayShoots.length > 0 ? (
              <div className="space-y-2">
                {todayShoots.map((shoot: any) => (
                  <Link
                    key={shoot.id}
                    href={shoot.campaign?.id ? `/campaigns/${shoot.campaign.id}` : "/calendar"}
                    className="block rounded-lg bg-surface-secondary p-3 hover:bg-surface-tertiary transition-colors"
                  >
                    <p className="text-sm font-semibold text-text-primary">
                      {shoot.campaign?.name || shoot.shootName}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs font-medium text-text-secondary">
                      {shoot.callTime && (
                        <span className="flex items-center gap-1 text-primary">
                          <Clock className="h-3.5 w-3.5" />
                          Call {shoot.callTime.slice(0, 5)}
                        </span>
                      )}
                      {shoot.vendorCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {shoot.vendorCount} on set
                        </span>
                      )}
                      {shoot.location && (
                        <span className="flex items-center gap-1 text-text-tertiary">
                          <MapPin className="h-3 w-3" />
                          {shoot.location}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-tertiary text-center py-4">No shoots today</p>
            )}
          </div>
        </div>
      </Card>

      {/* Overdue gear alert */}
      {stats?.overdueReturns > 0 && (
        <Card className="border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <p className="text-sm font-semibold text-red-900">
                {stats.overdueReturns} gear item{stats.overdueReturns !== 1 ? "s" : ""} overdue for return
              </p>
            </div>
            <Link href="/gear">
              <Button size="sm" variant="secondary">
                View Inventory
              </Button>
            </Link>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
      <div className="lg:col-span-7 space-y-6">
        {/* Upcoming Shoots */}
        <Card padding="none">
          <CardHeader>
            <CardTitle>Upcoming Shoots</CardTitle>
            <Link href="/calendar">
              <Button variant="ghost" size="sm">
                View calendar
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <div className="p-3.5">
            {loadingShoots ? (
              <div className="space-y-2">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : upcomingShoots.length > 0 ? (
              <div className="space-y-2">
                {upcomingShoots.map((shoot: { id: string; date: string; shootName?: string; campaign?: { id: string; name: string } | null; location?: string }) => (
                  <Link
                    key={shoot.id}
                    href={shoot.campaign?.id ? `/campaigns/${shoot.campaign.id}` : "/calendar"}
                    className="flex items-center gap-3 rounded-lg bg-surface-secondary p-3 hover:bg-surface-tertiary transition-colors"
                  >
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-surface border border-border">
                      <span className="text-[10px] font-medium uppercase text-text-tertiary">
                        {format(parseISO(shoot.date), "MMM")}
                      </span>
                      <span className="text-sm font-bold text-text-primary leading-none">
                        {format(parseISO(shoot.date), "d")}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {shoot.campaign?.name || shoot.shootName || "Shoot"}
                      </p>
                      {shoot.location && (
                        <p className="text-xs text-text-tertiary">{shoot.location}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Calendar className="h-5 w-5" />}
                title="No upcoming shoots"
                description="Upcoming shoots will appear here."
              />
            )}
          </div>
        </Card>

        {/* Gear to Prep */}
        {upcomingReservations.length > 0 && (
          <Card padding="none">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                  Gear to Prep
                </span>
              </div>
              <Link href="/gear">
                <Button variant="ghost" size="sm">
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <div className="divide-y divide-border">
              {upcomingReservations.map((res: any) => (
                <div key={res.id} className="flex items-center justify-between px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {res.gearItem?.name || "Gear"}
                    </p>
                    {res.campaignName && (
                      <p className="text-xs text-text-tertiary truncate">{res.campaignName}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-xs font-medium text-text-secondary">
                      {format(parseISO(res.startDate), "MMM d")}
                    </p>
                    <Badge variant="custom" className="bg-amber-50 text-amber-700 mt-0.5">
                      Prep
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* My Gear */}
        <Card padding="none">
          <CardHeader>
            <CardTitle>Checked Out Gear</CardTitle>
            <Link href="/gear">
              <Button variant="ghost" size="sm">
                View inventory
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <div className="p-3.5">
          {loadingCheckouts ? (
            <div className="space-y-2">
              <CardSkeleton />
            </div>
          ) : activeCheckouts.length > 0 ? (
            <div className="space-y-2">
              {activeCheckouts.slice(0, 5).map((item: { id: string; name: string; brand?: string; model?: string; category?: string }) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg bg-surface-secondary p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">{item.name}</p>
                    <p className="text-xs text-text-tertiary">
                      {[item.brand, item.model].filter(Boolean).join(" ")}
                    </p>
                  </div>
                  {item.category && (
                    <Badge variant="custom" className="bg-amber-50 text-amber-700">
                      {item.category}
                    </Badge>
                  )}
                </div>
              ))}
              {activeCheckouts.length > 5 && (
                <p className="text-xs text-text-tertiary text-center pt-1">
                  +{activeCheckouts.length - 5} more items
                </p>
              )}
            </div>
          ) : (
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title="No gear checked out"
              description="Equipment you've checked out will appear here."
            />
          )}
          </div>
        </Card>
      </div>
      <div className="lg:col-span-3">
        <HighlightsCard />
      </div>
      </div>

      {/* Upcoming Reservations */}
      {upcomingReservations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Reservations</CardTitle>
            <Link href="/gear">
              <Button variant="ghost" size="sm">View all</Button>
            </Link>
          </CardHeader>
          <div className="space-y-2">
            {upcomingReservations.map((res: { id: string; gearItemName?: string; startDate: string; endDate: string; notes?: string }) => (
              <div
                key={res.id}
                className="flex items-center justify-between rounded-lg bg-surface-secondary p-3"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {res.gearItemName || "Gear"}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {format(parseISO(res.startDate), "MMM d")} – {format(parseISO(res.endDate), "MMM d")}
                    {res.notes && ` · ${res.notes}`}
                  </p>
                </div>
                <Badge variant="custom" className="bg-blue-50 text-blue-700">
                  Reserved
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
