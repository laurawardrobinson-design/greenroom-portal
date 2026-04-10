"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import type { Shoot, ShootCrew, AppUser, StudioSpace, SpaceReservation, CampaignVendor } from "@/types/domain";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { format, parseISO } from "date-fns";
import { X, Trash2, Users } from "lucide-react";

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
  campaignId: string;
  sameCrew: boolean;
  campaignPeople: AppUser[];
  campaignVendors: CampaignVendor[];
  producerRoles?: Record<string, string | null>;
  onClose: () => void;
  onMutate: () => void;
}

export function ShootDayModal({
  shoot,
  allShoots,
  open,
  wfNumber,
  canEdit,
  producerRoles,
  campaignId,
  sameCrew,
  campaignPeople,
  campaignVendors,
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
              campaignId={campaignId}
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

          <CrewList
            campaignId={campaignId}
            campaignPeople={campaignPeople}
            campaignVendors={campaignVendors}
            producerRoles={producerRoles}
            extraCrew={shoot.crew.filter(c => !campaignPeople.some(p => p.id === c.userId))}
            canEdit={canEdit}
            onRemoveCrew={handleRemoveCrew}
            showEmpty={!addingCrew}
            onMutate={onMutate}
          />

          {addingCrew && canEdit && (
            <AddCrewInline
              shootId={shoot.id}
              allShootIds={sameCrew ? allShoots.map((s) => s.id) : [shoot.id]}
              shootDateId={null}
              existingUserIds={shoot.crew.map((c) => c.userId)}
              campaignPeople={campaignPeople}
              onAdded={onMutate}
            />
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

// --- Per-date details (call time, location type, space reservations) ---
function ShootDateDetail({
  date,
  canEdit,
  campaignId,
  onMutate,
}: {
  date: { id: string; shootDate: string; callTime: string | null; location: string };
  canEdit: boolean;
  campaignId: string;
  onMutate: () => void;
}) {
  const { toast } = useToast();
  const parsed = parseTime(date.callTime);
  const [editingTime, setEditingTime] = useState(!!date.callTime);
  const [timeVal, setTimeVal] = useState(parsed.time);
  const [period, setPeriod] = useState<"AM" | "PM">(parsed.period);
  const [location, setLocation] = useState(date.location || "");
  const [locationType, setLocationType] = useState<"internal" | "external">("external");
  const autoSwitched = useRef(false);

  const { data: spaces } = useSWR<StudioSpace[]>(
    locationType === "internal" ? "/api/studio/spaces" : null,
    fetcher
  );

  const { data: existingReservations, mutate: mutateReservations } = useSWR<SpaceReservation[]>(
    `/api/studio/reservations?campaignId=${campaignId}&dateFrom=${date.shootDate}&dateTo=${date.shootDate}`,
    fetcher
  );

  // Auto-switch to internal if reservations already exist
  useEffect(() => {
    if (!autoSwitched.current && existingReservations && existingReservations.length > 0) {
      setLocationType("internal");
      autoSwitched.current = true;
    }
  }, [existingReservations]);

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

  async function toggleSpace(spaceId: string) {
    const existing = existingReservations?.find((r) => r.spaceId === spaceId);
    try {
      if (existing) {
        await fetch(`/api/studio/reservations?id=${existing.id}`, { method: "DELETE" });
      } else {
        await fetch("/api/studio/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId, spaceId, reservedDate: date.shootDate }),
        });
      }
      mutateReservations();
    } catch {
      toast("error", "Failed to update space reservation");
    }
  }

  // Row 1: Bay 1-4, Wardrobe / Row 2: Multipurpose, Prep Kitchens / Row 3: Conference, Bay 5/Set Kitchen
  function spaceRowOrder(s: StudioSpace): [number, number] {
    const n = s.name.toLowerCase();
    if (s.type === "shooting_bay") {
      const m = n.match(/bay\s*(\d+)/); const num = m ? parseInt(m[1]) : 99;
      if (num <= 4) return [0, num];
    }
    if (s.type === "wardrobe") return [0, 5];
    if (s.type === "multipurpose") return [1, 0];
    if (s.type === "prep_kitchen") return [1, n.includes("a") ? 1 : 2];
    if (s.type === "conference") return [2, 0];
    if (s.type === "set_kitchen") return [2, 1];
    return [3, 0];
  }

  const bookableTypes: StudioSpace["type"][] = [
    "shooting_bay", "set_kitchen", "prep_kitchen", "wardrobe", "multipurpose", "conference",
  ];
  const bookableSpaces = (spaces || [])
    .filter((s) => bookableTypes.includes(s.type))
    .sort((a, b) => {
      const [ar, ai] = spaceRowOrder(a); const [br, bi] = spaceRowOrder(b);
      return ar !== br ? ar - br : ai - bi;
    });

  // Group into rows
  const spaceRows: StudioSpace[][] = [];
  for (const s of bookableSpaces) {
    const [row] = spaceRowOrder(s);
    if (!spaceRows[row]) spaceRows[row] = [];
    spaceRows[row].push(s);
  }

  return (
    <div className="rounded-lg bg-surface-secondary px-3 py-2.5 text-sm space-y-2">
      {/* Row 1: Date + Call Time */}
      <div className="flex items-center gap-3">
        <span className="font-medium text-text-primary shrink-0 w-24">
          {format(parseISO(date.shootDate), "EEE, MMM d")}
        </span>
        {canEdit ? (
          editingTime ? (
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
          )
        ) : (
          date.callTime && <span className="text-text-secondary">{date.callTime}</span>
        )}
      </div>

      {/* Row 2: Location type toggle */}
      {canEdit && (
        <div className="flex rounded border border-border overflow-hidden w-fit">
          <button
            type="button"
            onClick={() => setLocationType("internal")}
            className={`px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              locationType === "internal"
                ? "bg-primary text-white"
                : "bg-surface text-text-tertiary hover:text-text-primary"
            }`}
          >
            Studio
          </button>
          <button
            type="button"
            onClick={() => setLocationType("external")}
            className={`px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              locationType === "external"
                ? "bg-primary text-white"
                : "bg-surface text-text-tertiary hover:text-text-primary"
            }`}
          >
            External
          </button>
        </div>
      )}

      {/* Row 3: Space picker or external location */}
      {canEdit ? (
        locationType === "internal" ? (
          <div className="space-y-1">
            {bookableSpaces.length === 0 && (
              <span className="text-xs text-text-tertiary">Loading spaces…</span>
            )}
            {spaceRows.filter(Boolean).map((row, i) => (
              <div key={i} className="flex flex-nowrap gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {row.map((space) => {
                  const reserved = existingReservations?.some((r) => r.spaceId === space.id);
                  return (
                    <button
                      key={space.id}
                      type="button"
                      onClick={() => toggleSpace(space.id)}
                      className={`shrink-0 px-2.5 py-0.5 text-[11px] font-medium rounded border transition-colors ${
                        reserved
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-surface text-text-tertiary border-border hover:border-primary/40 hover:text-text-primary"
                      }`}
                    >
                      {space.name}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onBlur={() => {
              if (location !== (date.location || "")) saveField("location", location);
            }}
            placeholder="Location"
            className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none text-text-secondary placeholder:text-text-tertiary text-sm"
          />
        )
      ) : (
        <>
          {existingReservations && existingReservations.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {existingReservations.map((r) => (
                <span key={r.id} className="text-xs font-medium text-primary">
                  {r.space?.name ?? "Studio"}
                </span>
              ))}
            </div>
          ) : date.location ? (
            <span className="text-xs text-text-secondary">{date.location}</span>
          ) : null}
        </>
      )}
    </div>
  );
}

// --- Inline-editable role label ---
function EditableRole({
  defaultRole, canEdit, onSave,
}: { defaultRole: string; canEdit: boolean; onSave?: (role: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(defaultRole);

  // Keep in sync if parent updates the role
  const prevDefault = useRef(defaultRole);
  if (defaultRole !== prevDefault.current) {
    prevDefault.current = defaultRole;
    setValue(defaultRole);
  }

  function commit(v: string) {
    const trimmed = v.trim() || defaultRole;
    setValue(trimmed);
    setEditing(false);
    if (trimmed !== defaultRole) onSave?.(trimmed);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(value);
          if (e.key === "Escape") { setValue(defaultRole); setEditing(false); }
        }}
        className="text-xs bg-transparent border-b border-primary focus:outline-none text-text-primary w-28"
      />
    );
  }
  return (
    <span
      onClick={() => canEdit && setEditing(true)}
      className={`text-xs text-text-tertiary shrink-0 ${canEdit ? "cursor-pointer hover:text-primary transition-colors" : ""}`}
    >
      {value}
    </span>
  );
}

// --- Crew list (internal people + vendors + extra shoot crew) ---
function CrewList({
  campaignId, campaignPeople, campaignVendors, producerRoles = {}, extraCrew, canEdit, onRemoveCrew, showEmpty, onMutate,
}: {
  campaignId: string;
  campaignPeople: AppUser[];
  campaignVendors: CampaignVendor[];
  producerRoles?: Record<string, string | null>;
  extraCrew: ShootCrew[];
  canEdit: boolean;
  onRemoveCrew: (id: string) => void;
  showEmpty: boolean;
  onMutate: () => void;
}) {
  const activeVendors = campaignVendors.filter(cv => cv.status !== "Rejected");
  const hasAnyone = campaignPeople.length > 0 || activeVendors.length > 0 || extraCrew.length > 0;

  if (!hasAnyone) {
    return showEmpty ? <p className="text-xs text-text-tertiary mb-2">No crew assigned</p> : null;
  }

  async function saveProducerRole(userId: string, role: string) {
    await fetch(`/api/campaigns/${campaignId}/producers/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignRole: role }),
    });
    onMutate();
  }

  async function saveVendorRole(cvId: string, role: string) {
    await fetch(`/api/campaign-vendors/${cvId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_campaign_role", campaignRole: role }),
    });
    onMutate();
  }

  return (
    <div className="mb-2">
      <div className="space-y-1">
        {campaignPeople.map((p) => (
          <div key={p.id} className="flex items-center gap-2 py-0.5">
            <span className="text-sm text-text-primary font-medium truncate">{p.name}</span>
            <EditableRole
              defaultRole={producerRoles[p.id] ?? p.role}
              canEdit={canEdit}
              onSave={(role) => saveProducerRole(p.id, role)}
            />
          </div>
        ))}
        {extraCrew.map((c) => (
          <div key={c.id} className="flex items-center justify-between py-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm text-text-primary font-medium truncate">{c.user?.name ?? "Unknown"}</span>
              <EditableRole defaultRole={c.roleOnShoot} canEdit={canEdit} />
            </div>
            {canEdit && (
              <button type="button" onClick={() => onRemoveCrew(c.id)} className="text-text-tertiary hover:text-error transition-colors shrink-0 ml-2">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {activeVendors.length > 0 && <div className="border-t border-border my-2" />}

      <div className="space-y-1">
        {activeVendors.map((cv) => (
          <div key={cv.id} className="flex items-center gap-2 py-0.5">
            <span className="text-sm text-text-primary font-medium truncate">
              {cv.vendor?.companyName ?? "Vendor"}
            </span>
            <EditableRole
              defaultRole={cv.campaignRole ?? cv.vendor?.category ?? "Vendor"}
              canEdit={canEdit}
              onSave={(role) => saveVendorRole(cv.id, role)}
            />
          </div>
        ))}
      </div>
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
      <UserAvatar name={crew.user?.name || "?"} favoriteProduct={crew.user?.favoritePublixProduct} size="sm" />
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
            className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 ${roleColor} ${
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
// Map a user's portal role to a shoot day role
function defaultShootRole(user: AppUser): string {
  const map: Record<string, string> = {
    Producer: "Producer",
    "Art Director": "Art Director",
    Admin: "Producer",
    Studio: "Studio Manager",
  };
  if (user.role === "Vendor") {
    // Use vendor title/category if it maps to a known shoot role
    const titleMap: Record<string, string> = {
      Photographer: "Photographer",
      "Food Stylist": "Food Stylist",
      "Prop Stylist": "Prop Stylist",
      Stylist: "Stylist",
      "Digital Tech": "Digital Tech",
      Retoucher: "Other",
    };
    return titleMap[user.title] ?? "Other";
  }
  return map[user.role] ?? "Other";
}

function AddCrewInline({
  shootId,
  allShootIds,
  shootDateId,
  existingUserIds,
  campaignPeople,
  onAdded,
}: {
  shootId: string;
  allShootIds: string[];
  shootDateId: string | null;
  existingUserIds: string[];
  campaignPeople: AppUser[];
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const { data: allUsers = [] } = useSWR<AppUser[]>(
    "/api/users?roles=Admin,Producer,Studio,Art Director",
    fetcher
  );
  const [role, setRole] = useState(SHOOT_ROLES[0]);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [addingAll, setAddingAll] = useState(false);
  const [focused, setFocused] = useState(false);

  const available = allUsers.filter((u) => !existingUserIds.includes(u.id));
  const filtered = search
    ? available.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase())
      )
    : available;
  const showDropdown = focused && search.length > 0 && filtered.length > 0;

  // Campaign people not already on this shoot
  const campaignCrew = campaignPeople.filter((p) => !existingUserIds.includes(p.id));

  async function postCrewToShoot(sid: string, userId: string, roleOnShoot: string) {
    const res = await fetch(`/api/shoots/${sid}/crew`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, roleOnShoot, shootDateId }),
    });
    // 409 = already on this shoot — treat as success
    if (!res.ok && res.status !== 409) throw new Error("Failed");
  }

  async function handleAdd(userId: string, roleOverride?: string) {
    setAdding(userId);
    try {
      await Promise.allSettled(
        allShootIds.map((sid) => postCrewToShoot(sid, userId, roleOverride ?? role))
      );
      setSearch("");
      onAdded();
    } catch {
      toast("error", "Failed to add crew member");
    } finally {
      setAdding(null);
    }
  }

  async function handleAddAll() {
    if (campaignCrew.length === 0) return;
    setAddingAll(true);
    try {
      await Promise.allSettled(
        campaignCrew.flatMap((p) =>
          allShootIds.map((sid) => postCrewToShoot(sid, p.id, defaultShootRole(p)))
        )
      );
      onAdded();
    } catch {
      toast("error", "Failed to add crew");
    } finally {
      setAddingAll(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {/* Add all from campaign */}
      {campaignCrew.length > 0 && (
        <button
          type="button"
          onClick={handleAddAll}
          disabled={addingAll}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
        >
          <Users className="h-3.5 w-3.5" />
          {addingAll ? "Adding…" : `Add all from campaign (${campaignCrew.length})`}
        </button>
      )}

      {/* Search */}
      <div className="flex items-center gap-2">
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
                  <UserAvatar name={u.name} favoriteProduct={u.favoritePublixProduct} size="xs" />
                  <span className="font-medium text-text-primary">{u.name}</span>
                  <span className="text-text-tertiary ml-auto">{u.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
