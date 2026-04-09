"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { MealCard } from "@/components/studio/meal-card";
import { MealFormModal } from "@/components/studio/meal-form-modal";
import { nextStatus } from "@/lib/constants/meals";
import type { ShootMeal, MealHandlerRole } from "@/types/domain";
import {
  Utensils,
  Plus,
  ChevronDown,
  AlertCircle,
  Users,
} from "lucide-react";
import { format, parseISO } from "date-fns";

export interface ShootDayBlockProps {
  campaignId: string;
  campaignName: string;
  wfNumber: string;
  shootDate: string;
  meals: ShootMeal[];
  userRole: string;
  onRefresh: () => void;
}

export function ShootDayBlock({
  campaignId,
  campaignName,
  wfNumber,
  shootDate,
  meals,
  userRole,
  onRefresh,
}: ShootDayBlockProps) {
  const { toast } = useToast();
  const [addModal, setAddModal] = useState(false);
  const [editMeal, setEditMeal] = useState<ShootMeal | null>(null);
  const [expanded, setExpanded] = useState(true);

  const defaultHandlerRole: MealHandlerRole =
    userRole === "Studio" ? "studio" : "producer";

  const totalHeadcount = meals.reduce((acc, m) => {
    if (m.mealType !== "crafty" && m.headcount) return Math.max(acc, m.headcount);
    return acc;
  }, 0);

  const hasRestrictions = meals.some((m) => m.dietaryNotes);
  const pendingCount = meals.filter((m) => m.status === "pending").length;

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/shoot-meals?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast("success", "Meal removed");
      onRefresh();
    } catch {
      toast("error", "Failed to remove meal");
    }
  }

  async function handleStatusAdvance(meal: ShootMeal) {
    const next = nextStatus(meal.status);
    if (!next) return;
    try {
      await fetch("/api/shoot-meals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: meal.id, status: next }),
      });
      onRefresh();
    } catch {
      toast("error", "Failed to update status");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-3.5 py-2.5 border-b border-border hover:bg-surface-secondary/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <Utensils className="h-4 w-4 shrink-0 text-primary" />
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              {format(parseISO(shootDate), "EEE, MMM d")}
            </span>
            <span className="text-xs text-text-tertiary">
              {wfNumber} — {campaignName}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 && (
            <Badge variant="custom" className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px]">
              {pendingCount} pending
            </Badge>
          )}
          {totalHeadcount > 0 && (
            <span className="flex items-center gap-1 text-xs text-text-tertiary">
              <Users className="h-3 w-3" />
              {totalHeadcount}
            </span>
          )}
          {hasRestrictions && (
            <AlertCircle className="h-4 w-4 text-amber-500" aria-label="Dietary restrictions present" />
          )}
          <ChevronDown className={`h-4 w-4 text-text-tertiary transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="p-3.5 space-y-2">
          {meals.length === 0 ? (
            <p className="text-xs text-text-tertiary italic text-center py-2">No meals or crafty added yet.</p>
          ) : (
            meals.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                canEdit={
                  userRole === "Admin" ||
                  (userRole === "Studio" && meal.handlerRole === "studio") ||
                  (userRole === "Producer" && meal.handlerRole === "producer")
                }
                onEdit={() => setEditMeal(meal)}
                onDelete={() => handleDelete(meal.id)}
                onStatusAdvance={() => handleStatusAdvance(meal)}
              />
            ))
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-1"
            onClick={() => setAddModal(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add meal or crafty
          </Button>
        </div>
      )}

      {/* Modals */}
      {addModal && (
        <MealFormModal
          campaignId={campaignId}
          shootDate={shootDate}
          meal={null}
          defaultHandlerRole={defaultHandlerRole}
          onClose={() => setAddModal(false)}
          onSaved={onRefresh}
        />
      )}
      {editMeal && (
        <MealFormModal
          campaignId={campaignId}
          shootDate={shootDate}
          meal={editMeal}
          defaultHandlerRole={defaultHandlerRole}
          onClose={() => setEditMeal(null)}
          onSaved={onRefresh}
        />
      )}
    </div>
  );
}
