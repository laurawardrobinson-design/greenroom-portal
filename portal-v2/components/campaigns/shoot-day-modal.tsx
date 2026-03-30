"use client";

import { useState } from "react";
import useSWR from "swr";
import type { Shoot, ShootCrew, AppUser } from "@/types/domain";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { format, parseISO } from "date-fns";
import { X, Trash2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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

export function getShootDayName(
  shoot: Shoot,
  allShoots: Shoot[],
  wfNumber: string | null | undefined
): string {
  const date = shoot.dates[0]?.shootDate;
  if (!date) return shoot.name || "Unnamed Day";

  const sorted = [...allShoots]
    .filter((s) => s.dates.length > 0)
    .sort((a, b) => a.dates[0].shootDate.localeCompare(b.dates[0].shootDate));

  const idx = sorted.findIndex((s) => s.id === shoot.id);
  const dayNum = idx + 1;
  const dateLabel = format(parseISO(date), "MMM d");
  return wfNumber
    ? `${dateLabel} - Day ${dayNum} of ${wfNumber}`
    : `${dateLabel} - Day ${dayNum}`;
}

interface Props {
  shoot: Shoot | null;
  allShoots: Shoot[];
  open: boolean;
  wfNumber: string | null | undefined;
  canEdit: boolean;
  onClose: () => void;
  onMutate: () => void;
}

export function ShootDayModal({
  shoot,
  allShoots,
  open,
  wfNumber,
  canEdit,
  onClose,
  onMutate,
}: Props) {
  const { toast } = useToast();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [addingCrew, setAddingCrew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!shoot) return null;

  const computedName = getShootDayName(shoot, allShoots, wfNumber);
  const isCustomName = shoot.name && shoot.name !== computedName;
  const displayName = isCustomName ? shoot.name : computedName;
  const date = shoot.dates[0];

  async function handleSaveName() {
    const trimmed = nameValue.trim();
    if (!trimmed) {
      setEditingName(false);
      return;
    }
    try {
      await fetch(`/api/shoots/${shoot!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      setEditingName(false);
      onMutate();
    } catch {
      toast("error", "Failed to rename");
    }
  }

  async function handleResetName() {
    try {
      await fetch(`/api/shoots/${shoot!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: computedName }),
      });
      onMutate();
    } catch {
      toast("error", "Failed to reset name");
    }
  }

  async function handleTypeChange(t: string) {
    if (t === shoot!.shootType) return;
    try {
      await fetch(`/api/shoots/${shoot!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shootType: t }),
      });
      onMutate();
    } catch {
      toast("error", "Failed to update type");
    }
  }

  async function handleDeleteShoot() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/shoots/${shoot!.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Shoot day removed");
      onClose();
      onMutate();
    } catch {
      toast("error", "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  async function handleRemoveCrew(crewId: string) {
    try {
      await fetch(`/api/shoot-crew/${crewId}`, { method: "DELETE" });
      onMutate();
    } catch {
      toast("error", "Failed to remove crew member");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={displayName} size="lg">
      <div className="space-y-5">

        {/* Name */}
        {canEdit && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1.5">
              Name
            </p>
            {editingName ? (
              <input
                autoFocus
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="w-full text-sm text-text-primary bg-transparent border-b border-primary focus:outline-none"
              />
            ) : (
              <div className="flex items-center gap-2.5">
                <span className="text-sm text-text-primary">{displayName}</span>
                <button
                  type="button"
                  onClick={() => { setNameValue(displayName!); setEditingName(true); }}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  rename
                </button>
                {isCustomName && (
                  <button
                    type="button"
                    onClick={handleResetName}
                    className="text-[10px] text-text-tertiary hover:text-text-primary transition-colors"
                  >
                    reset to default
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Type */}
        {canEdit && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1.5">
              Type
            </p>
            <div className="flex rounded-md border border-border overflow-hidden w-fit">
              {(["Photo", "Video", "Hybrid", "Other"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
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

        {/* Date details */}
        {date && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1.5">
              Details
            </p>
            <ShootDateDetail
              date={date}
              canEdit={canEdit}
              onMutate={onMutate}
            />
          </div>
        )}

        {/* Crew */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              Crew
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={() => setAddingCrew(!addingCrew)}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {addingCrew ? "Done" : "+ Add crew"}
              </button>
            )}
          </div>

          {shoot.crew.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {shoot.crew.map((c) => (
                <CrewChip
                  key={c.id}
                  crew={c}
                  canEdit={canEdit}
                  onRemove={() => handleRemoveCrew(c.id)}
                  shootId={shoot.id}
                  onMutate={onMutate}
                />
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
        </div>

        {/* Delete */}
        {canEdit && (
          <div className="pt-4 border-t border-border">
            {confirmDelete ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-error">
                  Delete this shoot day and all its data?
                </span>
                <button
                  type="button"
                  onClick={handleDeleteShoot}
                  disabled={deleting}
                  className="text-xs font-medium text-error hover:text-error/80 transition-colors disabled:opacity-50"
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
                Delete shoot day
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function parseTime(raw: string | null): { time: string; period: "AM" | "PM" } {
  if (!raw) return { time: "8:30", period: "AM" };
  const m = raw.match(/^(\d+):(\d+)\s*(AM|PM)?/i);
  if (!m) return { time: "8:30", period: "AM" };
  let h = parseInt(m[1]); const min = m[2];
  const explicitPeriod = m[3]?.toUpperCase() as "AM" | "PM" | undefined;
  const period = explicitPeriod ?? (h >= 12 ? "PM" : "AM");
  if (!explicitPeriod) { if (h > 12) h -= 12; if (h === 0) h = 12; }
  return { time: `${h}:${min}`, period };
}

// --- Per-date details (call time + location) ---
function ShootDateDetail({
  date,
  canEdit,
  onMutate,
}: {
  date: { id: string; shootDate: string; callTime: string | null; location: string };
  canEdit: boolean;
  onMutate: () => void;
}) {
  const { toast } = useToast();
  const parsed = parseTime(date.callTime);
  const [editingTime, setEditingTime] = useState(!!date.callTime);
  const [timeVal, setTimeVal] = useState(parsed.time);
  const [period, setPeriod] = useState<"AM" | "PM">(parsed.period);
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

  function saveTime(t = timeVal, p = period) {
    const combined = `${t} ${p}`;
    if (combined !== (date.callTime ?? "8:30 AM")) saveField("call_time", combined);
  }

  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface-secondary px-3 py-2.5 text-sm">
      <span className="font-medium text-text-primary shrink-0 w-24">
        {format(parseISO(date.shootDate), "EEE, MMM d")}
      </span>
      {canEdit ? (
        <>
          {editingTime ? (
            <div className="flex items-center gap-1 shrink-0">
              <input
                autoFocus
                type="text"
                value={timeVal}
                onChange={(e) => setTimeVal(e.target.value)}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                onBlur={() => saveTime()}
                className="w-12 bg-transparent focus:outline-none text-sm text-text-primary text-center"
              />
              <select
                value={period}
                onChange={(e) => { const p = e.target.value as "AM" | "PM"; setPeriod(p); saveTime(timeVal, p); }}
                className="bg-transparent text-sm text-text-secondary focus:outline-none cursor-pointer"
              >
                <option>AM</option>
                <option>PM</option>
              </select>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingTime(true)}
              className="text-sm text-text-tertiary hover:text-text-secondary transition-colors shrink-0"
            >
              + Call Time
            </button>
          )}
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onBlur={() => {
              if (location !== (date.location || "")) saveField("location", location);
            }}
            placeholder="Location"
            className="flex-1 bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none text-text-secondary placeholder:text-text-tertiary"
          />
        </>
      ) : (
        <>
          {date.callTime && (
            <span className="text-text-secondary">{date.callTime}</span>
          )}
          {date.location && (
            <span className="text-text-secondary truncate">{date.location}</span>
          )}
          {!date.callTime && !date.location && (
            <span className="text-text-tertiary italic text-xs">No details yet</span>
          )}
        </>
      )}
    </div>
  );
}

// --- Crew chip with inline role editing ---
function CrewChip({
  crew,
  canEdit,
  onRemove,
  shootId,
  onMutate,
}: {
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

  const roleColor =
    ROLE_COLORS[crew.roleOnShoot] || "bg-surface-tertiary text-text-secondary";

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
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        ) : (
          <span
            className={`inline-block text-[9px] font-medium px-1.5 py-0.5 rounded mt-0.5 ${roleColor} ${
              canEdit ? "cursor-pointer hover:ring-1 hover:ring-primary/30" : ""
            }`}
            onClick={() => canEdit && setEditingRole(true)}
          >
            {crew.roleOnShoot}
          </span>
        )}
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={onRemove}
          className="text-text-tertiary hover:text-error transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// --- Add crew inline typeahead ---
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
      await fetch(`/api/shoots/${shootId}/crew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, roleOnShoot: role, shootDateId }),
      });
      setSearch("");
      onAdded();
    } catch {
      toast("error", "Failed to add crew member");
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="text-[11px] border border-border rounded-md px-2 py-1.5 bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-primary shrink-0"
      >
        {SHOOT_ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <div className="relative flex-1">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search crew..."
          className="w-full text-xs border border-border rounded-md px-2.5 py-1.5 bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {showDropdown && (
          <div className="absolute top-full left-0 mt-1 w-full z-20 rounded-lg border border-border bg-surface shadow-lg overflow-hidden">
            {filtered.slice(0, 8).map((u) => (
              <button
                key={u.id}
                type="button"
                disabled={adding === u.id}
                onMouseDown={() => handleAdd(u.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-secondary transition-colors disabled:opacity-50"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                  {u.name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <span className="font-medium text-text-primary">{u.name}</span>
                <span className="text-text-tertiary ml-auto">{u.role}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
