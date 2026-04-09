"use client";

import { Badge } from "@/components/ui/badge";
import { MEAL_TYPES, MEAL_STATUS_STYLES, nextStatus } from "@/lib/constants/meals";
import type { ShootMeal } from "@/types/domain";
import {
  Utensils,
  CheckCircle2,
  Clock,
  Users,
  Edit2,
  Trash2,
  ShoppingBag,
} from "lucide-react";

interface MealCardProps {
  meal: ShootMeal;
  canEdit: boolean;
  compact?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onStatusAdvance: () => void;
}

export function MealCard({ meal, canEdit, compact, onEdit, onDelete, onStatusAdvance }: MealCardProps) {
  const { label: statusLabel, className: statusClass } = MEAL_STATUS_STYLES[meal.status];
  const MealIcon = MEAL_TYPES.find((m) => m.value === meal.mealType)?.icon ?? Utensils;
  const next = nextStatus(meal.status);

  if (compact) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-secondary px-3 py-2">
        <MealIcon className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
        <span className="text-sm font-medium text-text-primary capitalize">{meal.mealType}</span>
        <Badge variant="custom" className={`text-[10px] border ${statusClass}`}>
          {statusLabel}
        </Badge>
        {meal.headcount && (
          <span className="flex items-center gap-1 text-xs text-text-tertiary">
            <Users className="h-3 w-3" />
            {meal.headcount}
          </span>
        )}
        {meal.deliveryTime && (
          <span className="flex items-center gap-1 text-xs text-text-tertiary">
            <Clock className="h-3 w-3" />
            {meal.deliveryTime}
          </span>
        )}
        <span className="text-[10px] text-text-tertiary capitalize ml-auto">
          {meal.handlerRole === "studio" ? "Studio" : "Producer"}
        </span>
        {next && canEdit && (
          <button
            onClick={onStatusAdvance}
            title={`Mark as ${MEAL_STATUS_STYLES[next].label}`}
            className="rounded-md p-1 text-text-tertiary hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-secondary p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface border border-border">
        <MealIcon className="h-4 w-4 text-text-secondary" />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-text-primary capitalize">{meal.mealType}</span>
          <Badge
            variant="custom"
            className={`text-[10px] border ${statusClass}`}
          >
            {statusLabel}
          </Badge>
          <Badge
            variant="custom"
            className={`text-[10px] border ${meal.location === "greenroom" ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}
          >
            {meal.location === "greenroom" ? "Greenroom" : "Outside"}
          </Badge>
          <span className="text-[10px] text-text-tertiary capitalize ml-auto">
            {meal.handlerRole === "studio" ? "Studio Manager" : "Producer"}
          </span>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
          {meal.headcount && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {meal.headcount} people
            </span>
          )}
          {meal.deliveryTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {meal.deliveryTime}
            </span>
          )}
          {meal.vendor && (
            <span className="flex items-center gap-1">
              <ShoppingBag className="h-3 w-3" />
              {meal.vendor}
            </span>
          )}
        </div>

        {meal.dietaryNotes && (
          <p className="text-xs text-text-secondary">
            <span className="font-medium text-text-primary">Restrictions:</span> {meal.dietaryNotes}
          </p>
        )}
        {meal.preferences && (
          <p className="text-xs text-text-secondary">
            <span className="font-medium text-text-primary">Preferences:</span> {meal.preferences}
          </p>
        )}
        {meal.notes && (
          <p className="text-xs text-text-tertiary italic">{meal.notes}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {next && canEdit && (
          <button
            onClick={onStatusAdvance}
            title={`Mark as ${MEAL_STATUS_STYLES[next].label}`}
            className="rounded-md p-1.5 text-text-tertiary hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
        )}
        {canEdit && (
          <>
            <button
              onClick={onEdit}
              className="rounded-md p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="rounded-md p-1.5 text-text-tertiary hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
