"use client";

import { useState, useMemo } from "react";
import type { Shoot } from "@/types/domain";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { getShootDayName } from "@/components/campaigns/shoot-day-modal";
import { X, Users, Clapperboard } from "lucide-react";

interface Props {
  shoots: Shoot[];
  wfNumber: string | null | undefined;
  canEdit: boolean;
  onDayClick: (shoot: Shoot) => void;
  onMutate: () => void;
}

export function ShootDayListTile({
  shoots,
  wfNumber,
  canEdit,
  onDayClick,
  onMutate,
}: Props) {
  const { toast } = useToast();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingCallId, setEditingCallId] = useState<string | null>(null);
  const [editTimeVal, setEditTimeVal] = useState("");
  const [localTimes, setLocalTimes] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState(false);

  const sortedShoots = useMemo(
    () =>
      [...shoots]
        .filter((s) => s.dates.length > 0)
        .sort((a, b) =>
          a.dates[0].shootDate.localeCompare(b.dates[0].shootDate)
        ),
    [shoots]
  );

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

  function formatAsTyped(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    if (digits.length === 3)
      return parseInt(digits[0]) > 1
        ? `${digits[0]}:${digits.slice(1)}`
        : `${digits.slice(0, 2)}:${digits[2]}`;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }

  function normalizeTimeInput(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 3) return `${digits[0]}:${digits.slice(1)}`;
    if (digits.length === 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
    if (digits.length <= 2) return `${digits}:00`;
    return raw;
  }

  async function saveCallTime(dateId: string, value: string) {
    setLocalTimes((prev) => ({ ...prev, [dateId]: value }));
    try {
      await fetch(`/api/shoot-dates/${dateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call_time: value }),
      });
      onMutate();
    } catch {
      setLocalTimes((prev) => { const n = { ...prev }; delete n[dateId]; return n; });
      toast("error", "Failed to update call time");
    }
  }

  async function handleDelete(shoot: Shoot) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/shoots/${shoot.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setConfirmDeleteId(null);
      onMutate();
    } catch {
      toast("error", "Failed to remove shoot day");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card padding="none" className="flex flex-col h-full">
      <div className="flex items-center px-3.5 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Clapperboard className="h-4 w-4 shrink-0 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">Shoot Days</h3>
        </div>
      </div>

      {sortedShoots.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 px-3.5">
          <p className="text-xs text-text-tertiary text-center leading-relaxed">
            Click a date on the calendar
            <br />
            to add a shoot day
          </p>
        </div>
      ) : (
        <div className="overflow-y-auto max-h-64 space-y-1.5 px-3.5 py-3">
          {sortedShoots.map((shoot) => {
            const name = getShootDayName(shoot, shoots, wfNumber);
            const date = shoot.dates[0];
            const isConfirming = confirmDeleteId === shoot.id;
            const isEditingCall = editingCallId === date?.id;
            const displayCallTime = date ? (localTimes[date.id] ?? date.callTime) : null;
            const { time, period } = parseTime(displayCallTime);

            return (
              <div
                key={shoot.id}
                className="group rounded-lg border border-border bg-surface hover:border-primary/20 transition-colors"
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onDayClick(shoot)}
                    className="flex-1 text-left text-sm font-semibold text-text-primary hover:text-primary transition-colors truncate"
                  >
                    {name}
                  </button>

                  {date && !isConfirming && canEdit && (
                    isEditingCall ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-sm font-semibold text-primary">CALL</span>
                        <input
                          autoFocus
                          type="text"
                          value={editTimeVal}
                          onChange={(e) => setEditTimeVal(formatAsTyped(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const sel = e.currentTarget.nextElementSibling as HTMLSelectElement;
                              saveCallTime(date.id, `${normalizeTimeInput(editTimeVal)} ${sel.value}`);
                              setEditingCallId(null);
                            }
                          }}
                          onBlur={(e) => {
                            if (editingCallId !== date.id) return;
                            const sel = e.currentTarget.nextElementSibling as HTMLSelectElement;
                            saveCallTime(date.id, `${normalizeTimeInput(editTimeVal)} ${sel.value}`);
                            setEditingCallId(null);
                          }}
                          className="w-10 bg-transparent focus:outline-none text-sm font-semibold text-primary text-center p-0"
                        />
                        <select
                          defaultValue={period}
                          onChange={(e) => {
                            const inp = e.currentTarget.previousElementSibling as HTMLInputElement;
                            saveCallTime(date.id, `${inp.value} ${e.currentTarget.value}`);
                            setEditingCallId(null);
                          }}
                          className="bg-transparent text-sm font-semibold text-primary focus:outline-none cursor-pointer"
                        >
                          <option>AM</option>
                          <option>PM</option>
                        </select>
                      </div>
                    ) : displayCallTime ? (
                      <button
                        type="button"
                        onClick={() => { setEditingCallId(date.id); setEditTimeVal(time); }}
                        className="text-sm font-semibold text-primary shrink-0"
                      >
                        CALL {time} {period}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => saveCallTime(date.id, "8:30 AM")}
                        className="text-sm font-semibold text-text-tertiary hover:text-primary transition-colors shrink-0"
                      >
                        + Call Time
                      </button>
                    )
                  )}

                  {shoot.crew.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-text-tertiary shrink-0">
                      <Users className="h-2.5 w-2.5" />
                      {shoot.crew.length}
                    </span>
                  )}

                  {canEdit && !isConfirming && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(shoot.id)}
                      className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-text-tertiary hover:text-error transition-all shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {isConfirming && (
                  <div className="flex items-center gap-2.5 px-3 pb-2">
                    <span className="text-[10px] text-error">Remove this shoot day?</span>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => handleDelete(shoot)}
                      className="text-[10px] font-medium text-error hover:text-error/80 transition-colors disabled:opacity-50"
                    >
                      {deleting ? "Removing..." : "Remove"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-[10px] text-text-tertiary hover:text-text-primary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
