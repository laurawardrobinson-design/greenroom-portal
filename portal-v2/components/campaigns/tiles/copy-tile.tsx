"use client";

import { useState } from "react";
import { Type } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type { Campaign } from "@/types/domain";

interface Props {
  campaign: Campaign;
  canEdit: boolean;
  onUpdate: (field: string, value: string) => Promise<void>;
}

type CopyField = {
  key: "headline" | "cta" | "disclaimer" | "legal";
  label: string;
  hint: string;
  multiline?: boolean;
};

const FIELDS: CopyField[] = [
  { key: "headline", label: "Headline", hint: "The main message." },
  { key: "cta", label: "CTA", hint: "e.g. Shop now, Learn more." },
  { key: "disclaimer", label: "Disclaimer", hint: "Conditions, restrictions." },
  { key: "legal", label: "Legal", hint: "Copyright, brand, registration lines.", multiline: true },
];

export function CopyTile({ campaign, canEdit, onUpdate }: Props) {
  return (
    <Card padding="none">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <Type className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
          Campaign Copy
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-text-tertiary">
          Inherits to every deliverable
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {FIELDS.map((field, i) => (
          <CopyField
            key={field.key}
            field={field}
            value={campaign[field.key] ?? ""}
            canEdit={canEdit}
            onUpdate={onUpdate}
            className={`px-3.5 py-3 ${i < FIELDS.length - 1 ? "border-b md:border-b" : ""} ${
              i % 2 === 0 ? "md:border-r" : ""
            } border-border`}
          />
        ))}
      </div>
    </Card>
  );
}

function CopyField({
  field,
  value,
  canEdit,
  onUpdate,
  className,
}: {
  field: CopyField;
  value: string;
  canEdit: boolean;
  onUpdate: (field: string, value: string) => Promise<void>;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const { toast } = useToast();

  async function save() {
    if (draft === value) {
      setEditing(false);
      return;
    }
    try {
      await onUpdate(field.key, draft);
      toast("success", `${field.label} updated`);
    } catch {
      toast("error", `Failed to update ${field.label.toLowerCase()}`);
      setDraft(value);
    } finally {
      setEditing(false);
    }
  }

  const showPlaceholder = !value && !editing;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          {field.label}
        </span>
      </div>

      {editing && canEdit ? (
        field.multiline ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraft(value);
                setEditing(false);
              }
            }}
            rows={2}
            placeholder={field.hint}
            className="w-full text-sm bg-transparent text-text-primary focus:outline-none resize-none"
          />
        ) : (
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraft(value);
                setEditing(false);
              }
              if (e.key === "Enter") {
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            placeholder={field.hint}
            className="w-full text-sm bg-transparent text-text-primary focus:outline-none"
          />
        )
      ) : showPlaceholder ? (
        <p
          className={`text-sm italic text-text-tertiary ${
            canEdit ? "cursor-pointer hover:text-text-secondary" : ""
          }`}
          onClick={() => canEdit && setEditing(true)}
        >
          {field.hint}
        </p>
      ) : (
        <p
          className={`text-sm text-text-primary whitespace-pre-wrap ${
            canEdit ? "cursor-pointer hover:text-text-secondary" : ""
          }`}
          onClick={() => canEdit && setEditing(true)}
        >
          {value}
        </p>
      )}
    </div>
  );
}
