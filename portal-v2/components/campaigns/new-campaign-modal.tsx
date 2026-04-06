"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { DateChipPicker } from "@/components/ui/date-chip-picker";
import { useToast } from "@/components/ui/toast";
import type { AppUser } from "@/types/domain";
import {
  Plus,
  X,
  Camera,
  Video,
  Clapperboard,
  ChevronDown,
  ChevronUp,
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

interface ShootDraft {
  id: string; // temp client ID
  name: string;
  shootType: string;
  location: string;
  dates: string[];
  crew: { userId: string; role: string }[];
  expanded: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function NewCampaignModal({ open, onClose, onCreated }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Campaign fields
  const [campaignTitle, setCampaignTitle] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");

  // Shoots
  const [shoots, setShoots] = useState<ShootDraft[]>([]);

  // Available users for crew
  const { data: allUsers = [] } = useSWR<AppUser[]>(
    open ? "/api/users?roles=Admin,Producer,Studio,Art Director" : null,
    fetcher
  );

  function addShoot() {
    setShoots([
      ...shoots,
      {
        id: crypto.randomUUID(),
        name: "",
        shootType: "Photo",
        location: "",
        dates: [],
        crew: [],
        expanded: true,
      },
    ]);
  }

  function updateShoot(id: string, updates: Partial<ShootDraft>) {
    setShoots(shoots.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }

  function removeShoot(id: string) {
    setShoots(shoots.filter((s) => s.id !== id));
  }

  function toggleShootDate(shootId: string, date: string) {
    setShoots(
      shoots.map((s) => {
        if (s.id !== shootId) return s;
        const has = s.dates.includes(date);
        return {
          ...s,
          dates: has
            ? s.dates.filter((d) => d !== date)
            : [...s.dates, date].sort(),
        };
      })
    );
  }

  function removeShootDate(shootId: string, date: string) {
    setShoots(
      shoots.map((s) => {
        if (s.id !== shootId) return s;
        return { ...s, dates: s.dates.filter((d) => d !== date) };
      })
    );
  }

  function addCrewToShoot(shootId: string, userId: string, role: string) {
    setShoots(
      shoots.map((s) => {
        if (s.id !== shootId) return s;
        if (s.crew.some((c) => c.userId === userId)) return s;
        return { ...s, crew: [...s.crew, { userId, role }] };
      })
    );
  }

  function removeCrewFromShoot(shootId: string, userId: string) {
    setShoots(
      shoots.map((s) => {
        if (s.id !== shootId) return s;
        return { ...s, crew: s.crew.filter((c) => c.userId !== userId) };
      })
    );
  }

  function resetForm() {
    setCampaignTitle("");
    setBudget("");
    setNotes("");
    setShoots([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!campaignTitle.trim()) {
      toast("error", "Campaign name is required");
      return;
    }

    // Parse WF number
    const titleTrimmed = campaignTitle.trim();
    const wfMatch = titleTrimmed.match(/^WF[-\s]?(\d+)\s+(.+)$/i);
    const parsedWf = wfMatch ? `WF${wfMatch[1]}` : "";
    const parsedName = wfMatch ? wfMatch[2] : titleTrimmed;

    setSaving(true);
    try {
      // 1. Create the campaign
      const campaignRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wfNumber: parsedWf,
          name: parsedName,
          productionBudget: budget ? parseFloat(budget) : 0,
          notes: notes.trim(),
        }),
      });
      if (!campaignRes.ok) {
        const data = await campaignRes.json();
        throw new Error(data.error || "Failed to create campaign");
      }
      const campaign = await campaignRes.json();

      // 2. Create shoots (with dates and crew)
      for (const shoot of shoots) {
        const shootRes = await fetch("/api/shoots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId: campaign.id,
            name: shoot.name || `${shoot.shootType} Shoot`,
            shootType: shoot.shootType,
            location: shoot.location,
            dates: shoot.dates.map((d) => ({ shootDate: d })),
          }),
        });
        if (!shootRes.ok) continue;
        const createdShoot = await shootRes.json();

        // Add crew to the shoot
        for (const member of shoot.crew) {
          await fetch(`/api/shoots/${createdShoot.id}/crew`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: member.userId,
              roleOnShoot: member.role,
            }),
          });
        }
      }

      toast("success", "Campaign created");
      resetForm();
      onCreated();
      router.push(`/campaigns/${campaign.id}`);
    } catch (err) {
      toast(
        "error",
        err instanceof Error ? err.message : "Failed to create campaign"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Campaign" size="xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Campaign basics */}
        <div className="space-y-3">
          <Input
            label="Campaign"
            placeholder="WF302001 Spring Organic Pasta Launch"
            hint="Start with your WF number (e.g. WF302001) followed by the campaign name"
            value={campaignTitle}
            onChange={(e) => setCampaignTitle(e.target.value)}
            autoFocus
          />
          <Input
            label="Budget"
            type="number"
            placeholder="0"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
          <Textarea
            label="Notes"
            placeholder="Brief, context, or details..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Shoots */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Shoots</h3>
            <button
              type="button"
              onClick={addShoot}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Shoot
            </button>
          </div>

          {shoots.length === 0 ? (
            <button
              type="button"
              onClick={addShoot}
              className="w-full rounded-xl border-2 border-dashed border-border py-6 text-center text-sm text-text-tertiary hover:border-primary/30 hover:text-text-secondary transition-colors"
            >
              <Camera className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
              Add a shoot with dates and crew
            </button>
          ) : (
            <div className="space-y-2">
              {shoots.map((shoot) => {
                const TypeIcon =
                  SHOOT_TYPE_ICONS[shoot.shootType] || Camera;
                return (
                  <div
                    key={shoot.id}
                    className="rounded-xl border border-border overflow-hidden"
                  >
                    {/* Shoot header */}
                    <div className="flex items-center gap-2 p-3 bg-surface-secondary/50">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <TypeIcon className="h-3.5 w-3.5" />
                      </div>
                      <input
                        value={shoot.name}
                        onChange={(e) =>
                          updateShoot(shoot.id, { name: e.target.value })
                        }
                        placeholder={`${shoot.shootType} Shoot`}
                        className="flex-1 text-sm font-medium bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none"
                      />
                      <select
                        value={shoot.shootType}
                        onChange={(e) =>
                          updateShoot(shoot.id, {
                            shootType: e.target.value,
                          })
                        }
                        className="h-7 rounded-md border border-border bg-surface px-1.5 text-[11px] font-medium text-text-secondary focus:outline-none"
                      >
                        <option value="Photo">Photo</option>
                        <option value="Video">Video</option>
                        <option value="Hybrid">Hybrid</option>
                        <option value="Other">Other</option>
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          updateShoot(shoot.id, {
                            expanded: !shoot.expanded,
                          })
                        }
                        className="text-text-tertiary hover:text-text-primary"
                      >
                        {shoot.expanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeShoot(shoot.id)}
                        className="text-text-tertiary hover:text-error transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Expanded content */}
                    {shoot.expanded && (
                      <div className="p-3 space-y-3">
                        <Input
                          label="Location"
                          placeholder="Studio, on-location, etc."
                          value={shoot.location}
                          onChange={(e) =>
                            updateShoot(shoot.id, {
                              location: e.target.value,
                            })
                          }
                        />

                        {/* Dates */}
                        <div>
                          <label className="block text-sm font-medium text-text-primary mb-1.5">
                            Dates
                          </label>
                          <DateChipPicker
                            selectedDates={shoot.dates}
                            onToggleDate={(d) =>
                              toggleShootDate(shoot.id, d)
                            }
                            onRemoveDate={(d) =>
                              removeShootDate(shoot.id, d)
                            }
                          />
                        </div>

                        {/* Crew */}
                        <div>
                          <label className="block text-sm font-medium text-text-primary mb-1.5">
                            Crew
                          </label>
                          {shoot.crew.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {shoot.crew.map((c) => {
                                const u = allUsers.find(
                                  (u) => u.id === c.userId
                                );
                                return (
                                  <span
                                    key={c.userId}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary/8 px-2 py-1 text-xs font-medium text-primary"
                                  >
                                    {u?.name || "Unknown"}{" "}
                                    <span className="text-primary/50">
                                      {c.role}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeCrewFromShoot(
                                          shoot.id,
                                          c.userId
                                        )
                                      }
                                      className="text-primary/40 hover:text-primary"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          <CrewPicker
                            allUsers={allUsers}
                            existingUserIds={shoot.crew.map(
                              (c) => c.userId
                            )}
                            onAdd={(userId, role) =>
                              addCrewToShoot(shoot.id, userId, role)
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Create Campaign
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

// --- Inline crew picker ---
function CrewPicker({
  allUsers,
  existingUserIds,
  onAdd,
}: {
  allUsers: AppUser[];
  existingUserIds: string[];
  onAdd: (userId: string, role: string) => void;
}) {
  const [role, setRole] = useState(SHOOT_ROLES[0]);
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);

  const available = allUsers.filter((u) => !existingUserIds.includes(u.id));
  const filtered = search
    ? available.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase())
      )
    : available;
  const showDropdown = focused && search.length > 0 && filtered.length > 0;

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Type a name..."
          className="w-full h-7 rounded-md border border-border bg-surface px-2.5 text-[11px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-32 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
            {filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onAdd(u.id, role);
                  setSearch("");
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-surface-secondary transition-colors"
              >
                <UserAvatar name={u.name} favoriteProduct={u.favoritePublixProduct} size="xs" />
                <span className="text-[11px] font-medium text-text-primary">
                  {u.name}
                </span>
                <span className="text-[9px] text-text-tertiary ml-auto">
                  {u.role}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="h-7 rounded-md border border-border bg-surface px-1.5 text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {SHOOT_ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </div>
  );
}
