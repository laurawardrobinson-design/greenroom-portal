"use client";

import { useState } from "react";
import useSWR from "swr";
import { Palette, X, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type { AppUser } from "@/types/domain";
import type { CampaignAssignment } from "@/lib/services/campaign-assignments.service";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  campaignId: string;
  canEdit: boolean;
  allUsers: AppUser[];
}

export function CreativeTeamTile({ campaignId, canEdit, allUsers }: Props) {
  const { data: assignments = [], mutate } = useSWR<CampaignAssignment[]>(
    `/api/campaigns/${campaignId}/assignments`,
    fetcher
  );
  const { toast } = useToast();

  const primaryDesigner = assignments.find((a) => a.assignmentRole === "primary_designer");
  const primaryAd = assignments.find((a) => a.assignmentRole === "primary_art_director");
  const viewers = assignments.filter((a) => a.assignmentRole === "viewer");

  const designers = allUsers.filter((u) => u.role === "Designer" && u.active);
  const artDirectors = allUsers.filter((u) => u.role === "Art Director" && u.active);
  const viewerCandidates = allUsers.filter((u) => {
    if (!u.active) return false;
    if (viewers.some((v) => v.userId === u.id)) return false;
    if (primaryDesigner?.userId === u.id) return false;
    if (primaryAd?.userId === u.id) return false;
    // Anyone in the creative stack is viewer-eligible.
    return [
      "Admin",
      "Producer",
      "Post Producer",
      "Designer",
      "Art Director",
      "Creative Director",
    ].includes(u.role);
  });

  async function assign(role: "primary_designer" | "primary_art_director", userId: string | null) {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, assignmentRole: role }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast(
        "success",
        userId === null
          ? `${role === "primary_designer" ? "Designer" : "Art Director"} cleared`
          : `${role === "primary_designer" ? "Designer" : "Art Director"} assigned`
      );
      mutate();
    } catch {
      toast("error", "Failed to update assignment");
    }
  }

  async function addViewer(userId: string) {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, assignmentRole: "viewer" }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast("success", "Viewer added");
      mutate();
    } catch {
      toast("error", "Failed to add viewer");
    }
  }

  async function removeAssignment(assignmentId: string) {
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/assignments/${assignmentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(await res.text());
      toast("success", "Removed");
      mutate();
    } catch {
      toast("error", "Failed to remove");
    }
  }

  return (
    <Card padding="none" className="h-full">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <Palette className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
          Creative Team
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-text-tertiary">
          Owns versioning
        </span>
      </div>

      <div className="px-3.5 py-3 space-y-4">
        <PrimaryRow
          label="Designer"
          current={primaryDesigner?.user ?? null}
          candidates={designers}
          canEdit={canEdit}
          onAssign={(userId) => assign("primary_designer", userId)}
        />
        <PrimaryRow
          label="Art Director"
          current={primaryAd?.user ?? null}
          candidates={artDirectors}
          canEdit={canEdit}
          onAssign={(userId) => assign("primary_art_director", userId)}
        />

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">
            Viewers
          </p>
          {viewers.length === 0 && !canEdit && (
            <p className="text-xs italic text-text-tertiary">No viewers assigned.</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {viewers.map((v) =>
              v.user ? (
                <span
                  key={v.id}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-secondary border border-border px-2 py-0.5 text-xs text-text-primary"
                >
                  {v.user.name || v.user.email}
                  <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                    {v.user.role}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removeAssignment(v.id)}
                      className="ml-0.5 text-text-tertiary hover:text-text-primary"
                      aria-label="Remove viewer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ) : null
            )}
            {canEdit && <AddViewerButton candidates={viewerCandidates} onAdd={addViewer} />}
          </div>
        </div>
      </div>
    </Card>
  );
}

function PrimaryRow({
  label,
  current,
  candidates,
  canEdit,
  onAssign,
}: {
  label: string;
  current: { id: string; name: string; email: string } | null;
  candidates: AppUser[];
  canEdit: boolean;
  onAssign: (userId: string | null) => void;
}) {
  const [picking, setPicking] = useState(false);

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">
        {label}
      </p>
      {current && !picking ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-text-primary">{current.name || current.email}</span>
          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-[10px] uppercase tracking-wider text-text-tertiary hover:text-text-secondary"
                onClick={() => setPicking(true)}
              >
                Change
              </button>
              <button
                type="button"
                className="text-text-tertiary hover:text-text-primary"
                onClick={() => onAssign(null)}
                aria-label={`Clear ${label.toLowerCase()}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : canEdit ? (
        <select
          autoFocus={picking}
          onBlur={() => setPicking(false)}
          className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-primary"
          value={current?.id ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onAssign(v || null);
            setPicking(false);
          }}
        >
          <option value="">— pick a {label.toLowerCase()} —</option>
          {candidates.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.email}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-sm italic text-text-tertiary">Unassigned</p>
      )}
    </div>
  );
}

function AddViewerButton({
  candidates,
  onAdd,
}: {
  candidates: AppUser[];
  onAdd: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-text-tertiary hover:text-text-primary hover:border-text-secondary"
        disabled={candidates.length === 0}
        title={candidates.length === 0 ? "No eligible viewers" : "Add a viewer"}
      >
        <Plus className="h-3 w-3" /> Add viewer
      </button>
    );
  }

  return (
    <select
      autoFocus
      onBlur={() => setOpen(false)}
      className="rounded-md border border-border bg-transparent px-2 py-0.5 text-xs text-text-primary focus:outline-none focus:border-primary"
      value=""
      onChange={(e) => {
        const v = e.target.value;
        if (v) onAdd(v);
        setOpen(false);
      }}
    >
      <option value="">— pick a viewer —</option>
      {candidates.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name || u.email} ({u.role})
        </option>
      ))}
    </select>
  );
}
