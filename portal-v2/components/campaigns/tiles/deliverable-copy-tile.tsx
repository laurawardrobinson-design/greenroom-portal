"use client";

import { useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type { Campaign, CampaignDeliverable } from "@/types/domain";

interface Props {
  campaign: Campaign;
  deliverables: CampaignDeliverable[];
  canEdit: boolean;
  onMutate: () => void;
  bare?: boolean;
}

type OverrideKey =
  | "headlineOverride"
  | "ctaOverride"
  | "disclaimerOverride"
  | "legalOverride";

type CampaignCopyKey = "headline" | "cta" | "disclaimer" | "legal";

const FIELDS: Array<{ key: OverrideKey; inherit: CampaignCopyKey; label: string }> = [
  { key: "headlineOverride",   inherit: "headline",   label: "Headline" },
  { key: "ctaOverride",        inherit: "cta",        label: "CTA" },
  { key: "disclaimerOverride", inherit: "disclaimer", label: "Disclaimer" },
  { key: "legalOverride",      inherit: "legal",      label: "Legal" },
];

export function DeliverableCopyTile({ campaign, deliverables, canEdit, onMutate, bare }: Props) {
  if (deliverables.length === 0) return null;

  const body = (
    <div className="divide-y divide-border">
      {deliverables.map((d) => (
        <DeliverableRow
          key={d.id}
          campaign={campaign}
          deliverable={d}
          canEdit={canEdit}
          onMutate={onMutate}
        />
      ))}
    </div>
  );

  if (bare) return body;

  return (
    <Card padding="none">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <LayoutTemplate className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
          Deliverable Copy
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-text-tertiary">
          Blank = inherits campaign
        </span>
      </div>
      {body}
    </Card>
  );
}

function DeliverableRow({
  campaign,
  deliverable,
  canEdit,
  onMutate,
}: {
  campaign: Campaign;
  deliverable: CampaignDeliverable;
  canEdit: boolean;
  onMutate: () => void;
}) {
  return (
    <div className="px-3.5 py-3">
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-sm font-semibold text-text-primary">{deliverable.channel}</span>
        <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
          {deliverable.width} × {deliverable.height} · {deliverable.aspectRatio}
        </span>
        {deliverable.quantity > 1 && (
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            × {deliverable.quantity}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
        {FIELDS.map((field) => (
          <OverrideField
            key={field.key}
            deliverableId={deliverable.id}
            label={field.label}
            overrideKey={field.key}
            override={deliverable[field.key]}
            inheritedValue={campaign[field.inherit] ?? ""}
            canEdit={canEdit}
            onMutate={onMutate}
          />
        ))}
      </div>
    </div>
  );
}

function OverrideField({
  deliverableId,
  label,
  overrideKey,
  override,
  inheritedValue,
  canEdit,
  onMutate,
}: {
  deliverableId: string;
  label: string;
  overrideKey: OverrideKey;
  override: string | null;
  inheritedValue: string;
  canEdit: boolean;
  onMutate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(override ?? "");
  const { toast } = useToast();

  const isInherited = override === null;
  const effective = isInherited ? inheritedValue : override;

  async function save(newValue: string | null) {
    try {
      const res = await fetch(`/api/deliverables/${deliverableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [overrideKey]: newValue }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast("success", `${label} updated`);
      onMutate();
    } catch {
      toast("error", `Failed to update ${label.toLowerCase()}`);
    } finally {
      setEditing(false);
    }
  }

  function startEdit() {
    setDraft(override ?? "");
    setEditing(true);
  }

  async function onBlur() {
    const trimmed = draft;
    if (trimmed === (override ?? "")) {
      setEditing(false);
      return;
    }
    await save(trimmed || null);
  }

  async function resetToInherited() {
    if (isInherited) return;
    await save(null);
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          {label}
        </span>
        {!isInherited && canEdit && !editing && (
          <button
            type="button"
            onClick={resetToInherited}
            className="text-[10px] uppercase tracking-wider text-text-tertiary hover:text-text-secondary"
            title="Reset to inherit from campaign"
          >
            Reset
          </button>
        )}
      </div>

      {editing && canEdit ? (
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={onBlur}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(override ?? "");
              setEditing(false);
            }
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          }}
          placeholder={inheritedValue || "(empty)"}
          className="w-full text-sm bg-transparent text-text-primary focus:outline-none border-b border-primary/40"
        />
      ) : (
        <p
          className={`text-sm truncate ${
            isInherited ? "italic text-text-tertiary" : "text-text-primary"
          } ${canEdit ? "cursor-pointer hover:text-text-secondary" : ""}`}
          onClick={() => canEdit && startEdit()}
          title={effective || "(empty)"}
        >
          {effective ? effective : "(empty)"}
          {isInherited && effective && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-text-tertiary">
              Inherited
            </span>
          )}
        </p>
      )}
    </div>
  );
}
