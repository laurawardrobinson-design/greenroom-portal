"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { MealCard } from "@/components/studio/meal-card";
import { MealFormModal } from "@/components/studio/meal-form-modal";
import { SPACE_TYPE_COLOR, getSpaceIcon } from "@/lib/constants/studio";
import { nextStatus } from "@/lib/constants/meals";
import type { StudioSpace, SpaceReservation, ShootMeal, MealHandlerRole } from "@/types/domain";
import {
  CalendarDays,
  Building2,
  Coffee,
  Clock,
  MapPin,
  Plus,
  Camera,
  Sun,
} from "lucide-react";
import { format } from "date-fns";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

interface ShootEvent {
  id: string;
  date: string;
  location: string;
  callTime: string;
  shootName: string;
  shootType: string;
  campaign: {
    id: string;
    name: string;
    wfNumber: string;
    status: string;
    producerId: string | null;
    producerName: string | null;
  } | null;
}

interface TodayViewProps {
  userRole: string;
  onReserveSpace?: (space: StudioSpace, date: Date) => void;
}

export function TodayView({ userRole, onReserveSpace }: TodayViewProps) {
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");
  const monthStr = format(new Date(), "yyyy-MM");

  // Fetch today's data
  const { data: shoots } = useSWR<ShootEvent[]>(`/api/calendar?month=${monthStr}`, fetcher);
  const { data: spaces } = useSWR<StudioSpace[]>("/api/studio/spaces", fetcher);
  const { data: reservations, mutate: refreshRes } = useSWR<SpaceReservation[]>(
    `/api/studio/reservations?dateFrom=${today}&dateTo=${today}`,
    fetcher
  );
  const { data: meals, mutate: refreshMeals } = useSWR<ShootMeal[]>(
    `/api/shoot-meals?dateFrom=${today}&dateTo=${today}`,
    fetcher
  );

  const [addMealModal, setAddMealModal] = useState<{ campaignId: string; shootDate: string } | null>(null);

  // Filter shoots to today only
  const todayShoots = useMemo(() => {
    return (shoots ?? []).filter((s) => s.date === today);
  }, [shoots, today]);

  // Map reservations by space ID for quick lookup
  const resBySpaceId = useMemo(() => {
    const m = new Map<string, SpaceReservation>();
    (reservations ?? []).forEach((r) => m.set(r.spaceId, r));
    return m;
  }, [reservations]);

  // Map reservations by campaign ID
  const resByCampaignId = useMemo(() => {
    const m = new Map<string, SpaceReservation[]>();
    (reservations ?? []).forEach((r) => {
      const arr = m.get(r.campaignId) ?? [];
      arr.push(r);
      m.set(r.campaignId, arr);
    });
    return m;
  }, [reservations]);

  // Group meals by campaign
  const mealsByCampaign = useMemo(() => {
    const m = new Map<string, ShootMeal[]>();
    (meals ?? []).forEach((meal) => {
      const arr = m.get(meal.campaignId) ?? [];
      arr.push(meal);
      m.set(meal.campaignId, arr);
    });
    return m;
  }, [meals]);

  const bookedCount = (reservations ?? []).length;
  const totalSpaces = (spaces ?? []).length;

  const defaultHandlerRole: MealHandlerRole =
    userRole === "Studio" ? "studio" : "producer";

  async function handleStatusAdvance(meal: ShootMeal) {
    const next = nextStatus(meal.status);
    if (!next) return;
    try {
      await fetch("/api/shoot-meals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: meal.id, status: next }),
      });
      refreshMeals();
    } catch {
      toast("error", "Failed to update status");
    }
  }

  async function handleDeleteMeal(id: string) {
    try {
      const res = await fetch(`/api/shoot-meals?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast("success", "Meal removed");
      refreshMeals();
    } catch {
      toast("error", "Failed to remove meal");
    }
  }

  const SHOOT_TYPE_STYLES: Record<string, string> = {
    Photo: "bg-blue-50 text-blue-700 border-blue-200",
    Video: "bg-purple-50 text-purple-700 border-purple-200",
    Hybrid: "bg-amber-50 text-amber-700 border-amber-200",
    Other: "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <div className="space-y-5">
      {/* ─── Today's Schedule ─── */}
      <Card padding="none">
        <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            Today&apos;s Schedule
          </h3>
          <span className="ml-auto text-xs text-text-tertiary">
            {format(new Date(), "EEEE, MMMM d")}
          </span>
        </div>

        <div className="p-3.5">
          {todayShoots.length === 0 ? (
            <EmptyState
              icon={<Sun className="h-5 w-5" />}
              title="No shoots today"
              description="Enjoy the quiet day — or plan ahead on the Spaces tab."
            />
          ) : (
            <div className="space-y-2">
              {todayShoots.map((shoot) => {
                const campaignSpaces = shoot.campaign
                  ? resByCampaignId.get(shoot.campaign.id) ?? []
                  : [];
                return (
                  <Link
                    key={shoot.id}
                    href={shoot.campaign ? `/campaigns/${shoot.campaign.id}` : "#"}
                    className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-surface-secondary"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-text-primary">
                          {shoot.campaign?.wfNumber} — {shoot.campaign?.name || shoot.shootName}
                        </span>
                        <Badge
                          variant="custom"
                          className={`text-[10px] border ${SHOOT_TYPE_STYLES[shoot.shootType] ?? SHOOT_TYPE_STYLES.Other}`}
                        >
                          {shoot.shootType}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                        {shoot.callTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {shoot.callTime}
                          </span>
                        )}
                        {shoot.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {shoot.location}
                          </span>
                        )}
                        {shoot.campaign?.producerName && (
                          <span className="text-text-tertiary">
                            {shoot.campaign.producerName}
                          </span>
                        )}
                      </div>
                      {campaignSpaces.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {campaignSpaces.map((r) => {
                            const SpaceIcon = getSpaceIcon(r.space?.type ?? "");
                            const color = SPACE_TYPE_COLOR[r.space?.type ?? ""] ?? "bg-surface-secondary text-text-secondary border-border";
                            return (
                              <span
                                key={r.id}
                                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${color}`}
                              >
                                <SpaceIcon className="h-3 w-3" />
                                {r.space?.name ?? "Space"}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* ─── Two-column: Building Status + Food ─── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ─── Building Status ─── */}
        <Card padding="none">
          <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
            <Building2 className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Building Status
            </h3>
            <span className="ml-auto text-xs text-text-tertiary">
              {bookedCount}/{totalSpaces} in use
            </span>
          </div>

          <div className="divide-y divide-border">
            {(spaces ?? []).map((space) => {
              const res = resBySpaceId.get(space.id);
              const SpaceIcon = getSpaceIcon(space.type);
              const typeColor = SPACE_TYPE_COLOR[space.type] ?? "bg-surface-secondary text-text-secondary border-transparent";

              return (
                <div
                  key={space.id}
                  className="flex items-center gap-3 px-3.5 py-2"
                >
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border ${typeColor}`}>
                    <SpaceIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate">
                      {space.name}
                    </p>
                    {res ? (
                      <p className="text-[10px] text-text-secondary truncate">
                        {res.campaign?.wfNumber} — {res.campaign?.name}
                        {res.startTime && ` · ${res.startTime}`}
                        {res.endTime && `–${res.endTime}`}
                      </p>
                    ) : (
                      <p className="text-[10px] text-text-tertiary">Available</p>
                    )}
                  </div>
                  {res ? (
                    <Badge variant="custom" className="shrink-0 text-[10px] bg-primary/10 text-primary border-primary/20">
                      Booked
                    </Badge>
                  ) : onReserveSpace ? (
                    <button
                      onClick={() => onReserveSpace(space, new Date())}
                      className="shrink-0 rounded-md p-1 text-text-tertiary hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Reserve this space"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>

        {/* ─── Food & Crafty ─── */}
        <Card padding="none">
          <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
            <Coffee className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Food & Crafty
            </h3>
            {(meals ?? []).filter((m) => m.status === "pending").length > 0 && (
              <Badge variant="custom" className="ml-auto text-[10px] bg-amber-50 text-amber-700 border border-amber-200">
                {(meals ?? []).filter((m) => m.status === "pending").length} pending
              </Badge>
            )}
          </div>

          <div className="p-3.5">
            {(meals ?? []).length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-text-tertiary">No meals planned for today</p>
                {todayShoots.length > 0 && todayShoots[0].campaign && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setAddMealModal({
                        campaignId: todayShoots[0].campaign!.id,
                        shootDate: today,
                      })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Meal
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Group meals by campaign */}
                {Array.from(mealsByCampaign.entries()).map(([campaignId, campaignMeals]) => {
                  const firstMeal = campaignMeals[0];
                  return (
                    <div key={campaignId} className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                        {firstMeal.campaign?.wfNumber} — {firstMeal.campaign?.name}
                      </p>
                      {campaignMeals.map((meal) => (
                        <MealCard
                          key={meal.id}
                          meal={meal}
                          compact
                          canEdit={
                            userRole === "Admin" ||
                            (userRole === "Studio" && meal.handlerRole === "studio") ||
                            (userRole === "Producer" && meal.handlerRole === "producer")
                          }
                          onEdit={() => setAddMealModal({ campaignId: meal.campaignId, shootDate: today })}
                          onDelete={() => handleDeleteMeal(meal.id)}
                          onStatusAdvance={() => handleStatusAdvance(meal)}
                        />
                      ))}
                      <button
                        onClick={() => setAddMealModal({ campaignId, shootDate: today })}
                        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-tertiary hover:text-primary hover:bg-primary/5 transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        Add meal
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ─── Add Meal Modal ─── */}
      {addMealModal && (
        <MealFormModal
          campaignId={addMealModal.campaignId}
          shootDate={addMealModal.shootDate}
          meal={null}
          defaultHandlerRole={defaultHandlerRole}
          onClose={() => setAddMealModal(null)}
          onSaved={() => refreshMeals()}
        />
      )}
    </div>
  );
}
