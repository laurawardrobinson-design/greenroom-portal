"use client";

import { useState } from "react";
import useSWR from "swr";
import type { Shoot, ShootCrew, AppUser } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DateChipPicker } from "@/components/ui/date-chip-picker";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { format, parseISO } from "date-fns";
import {
  Plus,
  Camera,
  Video,
  Clapperboard,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
  Calendar,
  MapPin,
  Clock,
  X,
  Copy,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SHOOT_TYPE_ICONS: Record<string, typeof Camera> = {
  Photo: Camera,
  Video: Video,
  Hybrid: Clapperboard,
  Other: Camera,
};

const SHOOT_ROLES = [
  "Photographer",
  "Art Director",
  "Producer",
  "Digital Tech",
  "Stylist",
  "Food Stylist",
  "Prop Stylist",
  "PA",
  "Studio Manager",
  "Coordinator",
  "Other",
];

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
  campaignId: string;
  campaignName?: string;
  shoots: Shoot[];
  onMutate: () => void;
}

export function ShootsSection({ campaignId, campaignName, shoots, onMutate }: Props) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [expandedShoot, setExpandedShoot] = useState<string | null>(
    shoots.length === 1 ? shoots[0]?.id : null
  );
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("Photo");
  const [saving, setSaving] = useState(false);
  const canEdit = user?.role === "Admin" || user?.role === "Producer";

  async function handleCreateShoot() {
    setSaving(true);
    try {
      const res = await fetch("/api/shoots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          name: newName || `Day ${shoots.length + 1} (${campaignName || "Shoot"})`,
          shootType: newType,
          dates: [],
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const shoot = await res.json();
      toast("success", "Shoot created");
      setNewName("");
      setNewType("Photo");
      setAddingNew(false);
      setExpandedShoot(shoot.id);
      onMutate();
    } catch {
      toast("error", "Failed to create shoot");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">

      {/* Inline new shoot creation */}
      {addingNew && (
        <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/3 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateShoot();
                if (e.key === "Escape") setAddingNew(false);
              }}
              placeholder={`Day ${shoots.length + 1} (${campaignName || "Shoot"})`}
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
              {["Photo", "Video", "Hybrid"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewType(t)}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    newType === t
                      ? "bg-primary text-white"
                      : "bg-surface text-text-secondary hover:bg-surface-secondary"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleCreateShoot} loading={saving}>
              Create Shoot
            </Button>
            <button
              onClick={() => setAddingNew(false)}
              className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <p className="text-[10px] text-text-tertiary ml-auto">
              Select dates after creating
            </p>
          </div>
        </div>
      )}

      {shoots.length === 0 && !addingNew ? (
        <EmptyState
          icon={<Camera className="h-5 w-5" />}
          title="No shoots yet"
          description="Add a shoot to start planning dates and crew."
          action={
            canEdit ? (
              <Button size="sm" onClick={() => setAddingNew(true)}>
                <Plus className="h-3.5 w-3.5" />
                Add Shoot
              </Button>
            ) : undefined
          }
        />
      ) : (
        shoots.map((shoot) => (
          <ShootCard
            key={shoot.id}
            shoot={shoot}
            expanded={expandedShoot === shoot.id}
            onToggle={() =>
              setExpandedShoot(expandedShoot === shoot.id ? null : shoot.id)
            }
            canEdit={canEdit}
            onMutate={onMutate}
          />
        ))
      )}
    </div>
  );
}

// --- Individual Shoot Card ---
function ShootCard({
  shoot,
  expanded,
  onToggle,
  canEdit,
  onMutate,
}: {
  shoot: Shoot;
  expanded: boolean;
  onToggle: () => void;
  canEdit: boolean;
  onMutate: () => void;
}) {
  const { toast } = useToast();
  const [addingCrew, setAddingCrew] = useState(false);
  const [headerAddingCrew, setHeaderAddingCrew] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(shoot.name);
  const [copyingCrew, setCopyingCrew] = useState<string | null>(null);

  const TypeIcon = SHOOT_TYPE_ICONS[shoot.shootType] || Camera;

  async function handleSaveName() {
    if (!nameValue.trim() || nameValue === shoot.name) {
      setEditingName(false);
      setNameValue(shoot.name);
      return;
    }
    try {
      await fetch(`/api/shoots/${shoot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameValue.trim() }),
      });
      setEditingName(false);
      onMutate();
    } catch {
      toast("error", "Failed to rename shoot");
    }
  }

  async function handleDeleteShoot() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/shoots/${shoot.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Shoot deleted");
      onMutate();
    } catch {
      toast("error", "Failed to delete shoot");
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddDate(date: string) {
    try {
      const res = await fetch(`/api/shoots/${shoot.id}/dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: [{ shootDate: date }] }),
      });
      if (!res.ok) throw new Error("Failed");
      onMutate();
    } catch {
      toast("error", "Failed to add date");
    }
  }

  async function handleRemoveDate(dateId: string) {
    try {
      await fetch(`/api/shoot-dates/${dateId}`, { method: "DELETE" });
      onMutate();
    } catch {
      toast("error", "Failed to remove date");
    }
  }

  async function handleRemoveCrew(crewId: string) {
    try {
      await fetch(`/api/shoot-crew/${crewId}`, { method: "DELETE" });
      toast("success", "Crew member removed");
      onMutate();
    } catch {
      toast("error", "Failed to remove crew member");
    }
  }

  async function handleCopyCrewToDay(sourceDateId: string, targetDateId: string) {
    const sourceCrew = shoot.crew.filter((c) => c.shootDateId === sourceDateId);
    const targetUserIds = new Set(
      shoot.crew.filter((c) => c.shootDateId === targetDateId).map((c) => c.userId)
    );
    const toAdd = sourceCrew.filter((c) => !targetUserIds.has(c.userId));
    if (toAdd.length === 0) {
      toast("info", "No new crew to copy");
      return;
    }
    setCopyingCrew(targetDateId);
    try {
      await Promise.all(
        toAdd.map((c) =>
          fetch(`/api/shoots/${shoot.id}/crew`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: c.userId, roleOnShoot: c.roleOnShoot, shootDateId: targetDateId }),
          })
        )
      );
      toast("success", `${toAdd.length} crew member${toAdd.length !== 1 ? "s" : ""} copied`);
      onMutate();
    } catch {
      toast("error", "Failed to copy crew");
    } finally {
      setCopyingCrew(null);
    }
  }

  // Format dates for display
  const dateChips = formatShootDates(shoot.dates);

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      {/* Header — always visible */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
        >
          <TypeIcon className="h-3.5 w-3.5" />
        </button>

        {/* Name — click to expand, not to edit */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
          <p className="text-sm font-semibold text-text-primary truncate">
            {shoot.name || `Day ${1} (Shoot)`}
          </p>
        </div>

        {/* Date — prominent */}
        {shoot.dates.length > 0 && (
          <div className="flex flex-wrap gap-1 shrink-0">
            {dateChips.map((chip) => (
              <span
                key={chip}
                className="rounded-md bg-primary/8 px-2 py-0.5 text-xs font-semibold text-primary"
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        <span className="text-[10px] text-text-tertiary shrink-0">
          {shoot.crew.length > 0 && `${shoot.crew.length} crew`}
        </span>

        {canEdit && !expanded && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setHeaderAddingCrew(!headerAddingCrew); }}
            className="flex items-center gap-0.5 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors shrink-0"
          >
            <Plus className="h-3 w-3" />
            Crew
          </button>
        )}

        <button type="button" onClick={onToggle} className="shrink-0 p-0.5">
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-text-tertiary" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" />
          )}
        </button>
      </div>

      {/* Peek row — visible when collapsed, shows key info at a glance */}
      {!expanded && shoot.dates.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border/30 bg-surface-secondary/30 text-xs text-text-secondary">
          {shoot.dates[0]?.callTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-text-tertiary" />
              {shoot.dates[0].callTime}
            </span>
          )}
          {shoot.dates[0]?.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 text-text-tertiary" />
              {shoot.dates[0].location}
            </span>
          )}
          {(() => {
            const lead = shoot.crew.find(c =>
              ["Photographer", "Art Director", "Producer"].includes(c.roleOnShoot)
            ) || shoot.crew[0];
            return lead ? (
              <span className="ml-auto text-text-tertiary truncate">
                {lead.user?.name} · {lead.roleOnShoot}
              </span>
            ) : null;
          })()}
          {!shoot.dates[0]?.callTime && !shoot.dates[0]?.location && shoot.crew.length === 0 && (
            <span className="text-text-tertiary italic">No details yet</span>
          )}
        </div>
      )}

      {/* Header inline crew add — visible without expanding */}
      {headerAddingCrew && !expanded && canEdit && (
        <div className="border-t border-border px-3 py-2 bg-surface-secondary/50">
          <AddCrewInline
            shootId={shoot.id}
            shootDateId={null}
            existingUserIds={shoot.crew.map((c) => c.userId)}
            onAdded={() => { onMutate(); }}
          />
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-3">
          {/* Editable name — only available when expanded */}
          {canEdit && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">Name</span>
              {editingName ? (
                <input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") { setNameValue(shoot.name); setEditingName(false); }
                  }}
                  className="flex-1 text-sm font-semibold text-text-primary bg-transparent border-b border-primary focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="text-sm font-semibold text-text-primary hover:text-primary transition-colors"
                >
                  {shoot.name}
                </button>
              )}
            </div>
          )}
          {/* Shoot type selector */}
          {canEdit && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">Type</span>
              <div className="flex rounded-md border border-border overflow-hidden">
                {(["Photo", "Video", "Hybrid", "Other"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={async () => {
                      if (t === shoot.shootType) return;
                      try {
                        await fetch(`/api/shoots/${shoot.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ shootType: t }),
                        });
                        onMutate();
                      } catch {
                        toast("error", "Failed to update type");
                      }
                    }}
                    className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      shoot.shootType === t
                        ? "bg-primary text-white"
                        : "bg-surface text-text-tertiary hover:text-text-primary"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dates — calendar always visible for editors */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-text-secondary">
                Production Dates
              </span>
              {shoot.dates.length > 0 && (
                <span className="text-[10px] text-text-tertiary">
                  {dateChips.join(", ")}
                </span>
              )}
            </div>

            {canEdit && (
              <DateChipPicker
                selectedDates={shoot.dates.map((d) => d.shootDate)}
                onToggleDate={(date) => {
                  const existing = shoot.dates.find(
                    (d) => d.shootDate === date
                  );
                  if (existing) {
                    handleRemoveDate(existing.id);
                  } else {
                    handleAddDate(date);
                  }
                }}
                onRemoveDate={(date) => {
                  const existing = shoot.dates.find(
                    (d) => d.shootDate === date
                  );
                  if (existing) handleRemoveDate(existing.id);
                }}
              />
            )}
            {/* Per-date details — call time + location */}
            {shoot.dates.length > 0 && (
              <div className="mt-2 space-y-1">
                {shoot.dates
                  .sort((a, b) => a.shootDate.localeCompare(b.shootDate))
                  .map((d) => (
                  <ShootDateDetail
                    key={d.id}
                    date={d}
                    canEdit={canEdit}
                    shootId={shoot.id}
                    onMutate={onMutate}
                  />
                ))}
              </div>
            )}
            {!canEdit && shoot.dates.length === 0 && (
              <p className="text-xs text-text-tertiary">No dates selected</p>
            )}
          </div>

          {/* Crew */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-text-secondary">
                Crew
              </span>
              <div className="flex items-center gap-3">
                {canEdit && shoot.dates.length > 1 && (
                  <label className="flex items-center gap-1.5 text-[11px] text-text-tertiary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shoot.crewVariesByDay}
                      onChange={async (e) => {
                        await fetch(`/api/shoots/${shoot.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ crewVariesByDay: e.target.checked }),
                        });
                        onMutate();
                      }}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    Different crew per day
                  </label>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setAddingCrew(!addingCrew)}
                    className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    {addingCrew ? "Done" : "+ Add crew"}
                  </button>
                )}
              </div>
            </div>

            {shoot.crewVariesByDay && shoot.dates.length > 0 ? (
              /* Per-day crew view */
              <div className="space-y-3">
                {shoot.dates
                  .slice()
                  .sort((a, b) => a.shootDate.localeCompare(b.shootDate))
                  .map((d, dayIndex) => {
                  const dayCrew = shoot.crew.filter((c) => c.shootDateId === d.id);
                  const sortedDates = shoot.dates.slice().sort((a, b) => a.shootDate.localeCompare(b.shootDate));
                  const firstDate = sortedDates[0];
                  const firstDayCrew = shoot.crew.filter((c) => c.shootDateId === firstDate.id);
                  const canCopyFromDay1 = canEdit && dayIndex > 0 && firstDayCrew.length > 0;
                  const isFirstDay = dayIndex === 0;
                  return (
                    <div key={d.id} className="rounded-lg bg-surface-secondary/50 p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] font-medium text-text-secondary">
                          {format(parseISO(d.shootDate), "EEE, MMM d")}
                        </p>
                        <div className="flex items-center gap-2">
                          {isFirstDay && canEdit && firstDayCrew.length > 0 && shoot.dates.length > 1 && (
                            <button
                              type="button"
                              disabled={copyingCrew !== null}
                              onClick={async () => {
                                setCopyingCrew("all");
                                try {
                                  for (const targetDate of sortedDates.slice(1)) {
                                    await handleCopyCrewToDay(firstDate.id, targetDate.id);
                                  }
                                } finally {
                                  setCopyingCrew(null);
                                }
                              }}
                              className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                            >
                              <Copy className="h-2.5 w-2.5" />
                              {copyingCrew === "all" ? "Copying..." : `Copy to ${shoot.dates.length - 1} day${shoot.dates.length > 2 ? "s" : ""}`}
                            </button>
                          )}
                          {canCopyFromDay1 && (
                            <button
                              type="button"
                              disabled={copyingCrew === d.id}
                              onClick={() => handleCopyCrewToDay(firstDate.id, d.id)}
                              className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-primary transition-colors disabled:opacity-50"
                            >
                              <Copy className="h-2.5 w-2.5" />
                              {copyingCrew === d.id ? "Copying..." : `Copy from ${format(parseISO(firstDate.shootDate), "MMM d")}`}
                            </button>
                          )}
                        </div>
                      </div>
                      {dayCrew.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {dayCrew.map((c) => (
                            <CrewChip key={c.id} crew={c} canEdit={canEdit} onRemove={() => handleRemoveCrew(c.id)} shootId={shoot.id} onMutate={onMutate} />
                          ))}
                        </div>
                      )}
                      {addingCrew && canEdit && (
                        <AddCrewInline
                          shootId={shoot.id}
                          shootDateId={d.id}
                          existingUserIds={dayCrew.map((c) => c.userId)}
                          onAdded={onMutate}
                        />
                      )}
                      {!addingCrew && dayCrew.length === 0 && (
                        <p className="text-[10px] text-text-tertiary">No crew</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Same crew for all days */
              <>
                {shoot.crew.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {shoot.crew.map((c) => (
                      <CrewChip key={c.id} crew={c} canEdit={canEdit} onRemove={() => handleRemoveCrew(c.id)} shootId={shoot.id} onMutate={onMutate} />
                    ))}
                  </div>
                )}

                {addingCrew && canEdit && (
                  <AddCrewInline
                    shootId={shoot.id}
                    shootDateId={null}
                    existingUserIds={shoot.crew.map((c) => c.userId)}
                    onAdded={onMutate}
                  />
                )}

                {!addingCrew && shoot.crew.length === 0 && (
                  <p className="text-xs text-text-tertiary">No crew assigned</p>
                )}
              </>
            )}
          </div>

          {/* Delete shoot */}
          {canEdit && (
            <div className="pt-2 border-t border-border">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-error font-medium">Delete this shoot and all its data?</span>
                  <button
                    type="button"
                    onClick={handleDeleteShoot}
                    disabled={deleting}
                    className="text-xs font-medium text-error hover:text-error/80 transition-colors"
                  >
                    {deleting ? "Deleting..." : "Yes, delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-error transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete shoot
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Per-date details (call time + location) ---
function ShootDateDetail({
  date,
  canEdit,
  shootId,
  onMutate,
}: {
  date: { id: string; shootDate: string; callTime: string | null; location: string };
  canEdit: boolean;
  shootId: string;
  onMutate: () => void;
}) {
  const { toast } = useToast();
  const [callTime, setCallTime] = useState(date.callTime || "");
  const [location, setLocation] = useState(date.location || "");

  async function saveField(field: string, value: string) {
    try {
      await fetch(`/api/shoot-dates/${date.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value || null }),
      });
      onMutate();
    } catch {
      toast("error", "Failed to update");
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-surface-secondary px-2.5 py-1.5 text-xs">
      <span className="font-medium text-text-primary shrink-0 w-20">
        {format(parseISO(date.shootDate), "EEE, MMM d")}
      </span>
      {canEdit ? (
        <>
          <input
            type="time"
            value={callTime}
            onChange={(e) => setCallTime(e.target.value)}
            onBlur={() => { if (callTime !== (date.callTime || "")) saveField("call_time", callTime); }}
            placeholder="Call time"
            className="w-24 bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none text-text-secondary placeholder:text-text-tertiary"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onBlur={() => { if (location !== (date.location || "")) saveField("location", location); }}
            placeholder="Location"
            className="flex-1 bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none text-text-secondary placeholder:text-text-tertiary"
          />
        </>
      ) : (
        <>
          {date.callTime && <span className="text-text-secondary">{date.callTime}</span>}
          {date.location && <span className="text-text-tertiary">{date.location}</span>}
        </>
      )}
    </div>
  );
}

// --- Crew chip (with inline role editing) ---
function CrewChip({ crew, canEdit, onRemove, shootId, onMutate }: {
  crew: ShootCrew;
  canEdit: boolean;
  onRemove: () => void;
  shootId: string;
  onMutate: () => void;
}) {
  const { toast } = useToast();
  const [editingRole, setEditingRole] = useState(false);

  async function handleRoleChange(newRole: string) {
    try {
      await fetch(`/api/shoot-crew/${crew.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleOnShoot: newRole }),
      });
      setEditingRole(false);
      onMutate();
    } catch {
      toast("error", "Failed to update role");
    }
  }

  const roleColor = ROLE_COLORS[crew.roleOnShoot] || "bg-surface-tertiary text-text-secondary";

  return (
    <div className="inline-flex items-center gap-2 rounded-lg bg-surface-secondary px-2.5 py-1.5 border border-border/40">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
        {(crew.user?.name || "?")
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-text-primary leading-tight truncate">
          {crew.user?.name || "Unknown"}
        </p>
        {editingRole && canEdit ? (
          <select
            autoFocus
            value={crew.roleOnShoot}
            onChange={(e) => handleRoleChange(e.target.value)}
            onBlur={() => setEditingRole(false)}
            className="text-[10px] bg-transparent border-b border-primary focus:outline-none text-text-primary"
          >
            {SHOOT_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        ) : (
          <span
            className={`inline-block text-[9px] font-medium px-1.5 py-0.5 rounded mt-0.5 ${roleColor} ${canEdit ? "cursor-pointer hover:ring-1 hover:ring-primary/30" : ""}`}
            onClick={() => canEdit && setEditingRole(true)}
          >
            {crew.roleOnShoot}
          </span>
        )}
      </div>
      {canEdit && (
        <button type="button" onClick={onRemove} className="text-text-tertiary hover:text-error transition-colors">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// --- Add crew inline (typeahead) ---
function AddCrewInline({
  shootId,
  shootDateId,
  existingUserIds,
  onAdded,
}: {
  shootId: string;
  shootDateId: string | null;
  existingUserIds: string[];
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const { data: allUsers = [] } = useSWR<AppUser[]>(
    "/api/users?roles=Admin,Producer,Studio",
    fetcher
  );
  const [role, setRole] = useState(SHOOT_ROLES[0]);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useState<HTMLInputElement | null>(null);

  const available = allUsers.filter((u) => !existingUserIds.includes(u.id));
  const filtered = search
    ? available.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase())
      )
    : available;
  const showDropdown = focused && search.length > 0 && filtered.length > 0;

  async function handleAdd(userId: string) {
    setAdding(userId);
    try {
      const res = await fetch(`/api/shoots/${shootId}/crew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, roleOnShoot: role, shootDateId }),
      });
      if (!res.ok) throw new Error("Failed");
      setSearch("");
      onAdded();
    } catch {
      toast("error", "Failed to add crew member");
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Type a name..."
            className="w-full h-8 rounded-lg border border-border bg-surface px-3 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-36 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
              {filtered.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  disabled={adding !== null}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleAdd(u.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-secondary transition-colors disabled:opacity-50"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                    {u.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-text-primary">
                    {u.name}
                  </span>
                  <span className="text-[10px] text-text-tertiary ml-auto">
                    {u.role}
                  </span>
                  {adding === u.id && (
                    <span className="text-[10px] text-primary">Adding...</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-8 rounded-lg border border-border bg-surface px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {SHOOT_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      {available.length === 0 && (
        <p className="text-[10px] text-text-tertiary">All team members assigned</p>
      )}
    </div>
  );
}

// Helper: format shoot dates into display strings
function formatShootDates(dates: Shoot["dates"]): string[] {
  if (dates.length === 0) return [];
  const sorted = [...dates].sort(
    (a, b) => a.shootDate.localeCompare(b.shootDate)
  );

  const chips: string[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(rangeEnd.shootDate);
    const curr = new Date(sorted[i].shootDate);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;

    if (diff === 1) {
      rangeEnd = sorted[i];
    } else {
      chips.push(formatRange(rangeStart.shootDate, rangeEnd.shootDate));
      rangeStart = sorted[i];
      rangeEnd = sorted[i];
    }
  }
  chips.push(formatRange(rangeStart.shootDate, rangeEnd.shootDate));
  return chips;
}

function formatRange(start: string, end: string): string {
  const s = parseISO(start);
  const e = parseISO(end);
  if (start === end) return format(s, "MMM d");
  if (s.getMonth() === e.getMonth()) return `${format(s, "MMM d")}–${format(e, "d")}`;
  return `${format(s, "MMM d")}–${format(e, "MMM d")}`;
}
