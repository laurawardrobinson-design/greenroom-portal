"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import type { Shoot, ShootCrew } from "@/types/domain";

const ROLE_COLORS: Record<string, string> = {
  Photographer: "bg-blue-50 text-blue-700",
  "Art Director": "bg-purple-50 text-purple-700",
  Producer: "bg-amber-50 text-amber-700",
  "Digital Tech": "bg-cyan-50 text-cyan-700",
  Stylist: "bg-pink-50 text-pink-700",
  "Food Stylist": "bg-pink-50 text-pink-700",
  "Prop Stylist": "bg-rose-50 text-rose-700",
  PA: "bg-slate-100 text-slate-600",
  "Studio Manager": "bg-emerald-50 text-emerald-700",
  Coordinator: "bg-indigo-50 text-indigo-700",
};

interface Props {
  shoots: Shoot[];
  selectedDates: string[];
}

export function CrewTile({ shoots, selectedDates }: Props) {
  // Get crew for selected dates, or all crew if no dates selected
  const crew = useMemo(() => {
    if (selectedDates.length === 0) {
      // Show all unique crew across all shoots
      const seen = new Map<string, ShootCrew>();
      for (const shoot of shoots) {
        for (const c of shoot.crew) {
          const key = `${c.userId}-${c.roleOnShoot}`;
          if (!seen.has(key)) seen.set(key, c);
        }
      }
      return Array.from(seen.values());
    }

    // Show crew for selected shoot dates
    const crewMembers: ShootCrew[] = [];
    const seen = new Set<string>();
    for (const shoot of shoots) {
      const matchingDateIds = shoot.dates
        .filter((d) => selectedDates.includes(d.shootDate))
        .map((d) => d.id);

      if (matchingDateIds.length === 0) continue;

      for (const c of shoot.crew) {
        const key = `${c.userId}-${c.roleOnShoot}`;
        if (seen.has(key)) continue;

        // If crew varies by day, only include crew assigned to matching dates
        if (shoot.crewVariesByDay) {
          if (c.shootDateId && matchingDateIds.includes(c.shootDateId)) {
            seen.add(key);
            crewMembers.push(c);
          }
        } else {
          seen.add(key);
          crewMembers.push(c);
        }
      }
    }
    return crewMembers;
  }, [shoots, selectedDates]);

  // Group by role
  const byRole = useMemo(() => {
    const map = new Map<string, ShootCrew[]>();
    for (const c of crew) {
      const role = c.roleOnShoot || "Other";
      if (!map.has(role)) map.set(role, []);
      map.get(role)!.push(c);
    }
    return Array.from(map.entries());
  }, [crew]);

  return (
    <Card padding="none" className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">Crew</h3>
          <span className="text-[10px] text-text-tertiary font-normal normal-case tracking-normal">
            {crew.length} member{crew.length !== 1 ? "s" : ""}
            {selectedDates.length > 0 && " for selected date" + (selectedDates.length > 1 ? "s" : "")}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 py-3">
        {crew.length > 0 ? (
          <div className="space-y-3">
            {byRole.map(([role, members]) => (
              <div key={role}>
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1.5">
                  {role}
                </p>
                <div className="space-y-1">
                  {members.map((c) => (
                    <div
                      key={c.id}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium ${
                        ROLE_COLORS[role] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <span className="truncate">{c.user?.name || "Unassigned"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title={selectedDates.length > 0 ? "No crew for selected date" : "No crew assigned"}
            description={selectedDates.length > 0 ? "Select a different date or assign crew in Shoot Management." : "Add crew in the Shoot Management tab."}
          />
        )}
      </div>
    </Card>
  );
}
