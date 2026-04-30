import type { GearCategory, GearMaintenance } from "@/types/domain";

// Industry-standard preventive-maintenance intervals for studio gear.
// Sources: Canon CPS / Nikon NPS factory programs, professional rental
// houses, Sound on Sound studio guides. See plan in
// /Users/laura/.claude/plans/research-photo-and-video-swift-walrus.md
export const MAINTENANCE_INTERVAL_DAYS: Record<GearCategory, number | null> = {
  Camera: 180,             // sensor clean every 6 months
  Lens: 180,               // AF calibration every 6 months
  Lighting: 90,            // fan/vent dust-out quarterly
  Audio: 90,               // frequency + firmware quarterly
  "Tripod / Support": 30,  // leg-lock + screw tightness monthly
  Grip: 90,                // knuckle + knob torque quarterly
  Accessories: 90,         // batteries cycle health quarterly
  Other: null,             // no default — user picks
  // Props categories — no preventive schedule
  "Surfaces & Backgrounds": null,
  Tableware: null,
  "Linens & Textiles": null,
  "Cookware & Small Wares": null,
  "Decorative Items": null,
  Furniture: null,
};

export const MAINTENANCE_INTERVAL_LABELS: Record<GearCategory, string | null> = {
  Camera: "Sensor clean every 6 months",
  Lens: "AF calibration every 6 months",
  Lighting: "Inspection every 90 days",
  Audio: "Frequency + firmware every 90 days",
  "Tripod / Support": "Lock + screw check every 30 days",
  Grip: "Torque check every 90 days",
  Accessories: "Battery health every 90 days",
  Other: null,
  "Surfaces & Backgrounds": null,
  Tableware: null,
  "Linens & Textiles": null,
  "Cookware & Small Wares": null,
  "Decorative Items": null,
  Furniture: null,
};

export function defaultNextDueDate(
  category: GearCategory | undefined,
  fromDate: string | Date = new Date()
): string | null {
  if (!category) return null;
  const days = MAINTENANCE_INTERVAL_DAYS[category];
  if (days == null) return null;
  const base = typeof fromDate === "string" ? new Date(fromDate) : fromDate;
  if (isNaN(base.getTime())) return null;
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

// Common maintenance tasks per category. Powers the quick-pick chips in the
// Log Maintenance modal — click a chip to drop a templated description into
// the field, ready to edit. Sources match the intervals above.
export const MAINTENANCE_TASKS: Record<GearCategory, string[]> = {
  Camera: [
    "Sensor clean",
    "Mount + contact clean",
    "Firmware check",
    "Full factory service",
    "Shutter count check",
  ],
  Lens: [
    "AF calibration",
    "Element + rear-mount clean",
    "Focus/zoom ring inspection",
    "Optical alignment service",
  ],
  Lighting: [
    "Cable + connector test",
    "Cooling fan + vent dust-out",
    "Color-temp / output calibration",
    "Lamp/LED inspection",
  ],
  Audio: [
    "Capsule + windscreen clean",
    "Battery contact clean",
    "Frequency coordination + firmware",
  ],
  "Tripod / Support": [
    "Leg-lock + screw tightness",
    "Head fluid/grease service",
    "Foot/spike inspection",
  ],
  Grip: [
    "Knuckle + knob torque check",
    "Sandbag + safety chain inspection",
  ],
  Accessories: [
    "Battery cycle / health check",
    "Storage charge top-up",
  ],
  Other: [],
  "Surfaces & Backgrounds": [],
  Tableware: [],
  "Linens & Textiles": [],
  "Cookware & Small Wares": [],
  "Decorative Items": [],
  Furniture: [],
};

export type MaintenanceDueState = "overdue" | "due-soon" | "ok" | "none";

export interface MaintenanceDueInfo {
  state: MaintenanceDueState;
  nextDueDate: string | null;
  daysUntilDue: number | null;
}

// Reduce a list of maintenance records into the soonest "next due" date.
// Considers only Scheduled / In-Progress records (not Completed / Cancelled).
export function computeDueInfo(
  records: GearMaintenance[],
  today: Date = new Date()
): MaintenanceDueInfo {
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  let soonest: string | null = null;
  for (const r of records) {
    if (r.status === "Completed" || r.status === "Cancelled") continue;
    const candidate = r.nextDueDate || r.scheduledDate;
    if (!candidate) continue;
    if (!soonest || candidate < soonest) soonest = candidate;
  }

  if (!soonest) {
    return { state: "none", nextDueDate: null, daysUntilDue: null };
  }

  const due = new Date(soonest);
  due.setHours(0, 0, 0, 0);
  const diffMs = due.getTime() - todayStart.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));

  let state: MaintenanceDueState;
  if (days < 0) state = "overdue";
  else if (days <= 30) state = "due-soon";
  else state = "ok";

  return { state, nextDueDate: soonest, daysUntilDue: days };
}
