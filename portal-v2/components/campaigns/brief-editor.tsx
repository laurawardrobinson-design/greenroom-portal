"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { BookOpen, Plus, X, Save } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  briefCompleteness,
  type CampaignBrief,
  type CampaignBriefInput,
} from "@/lib/services/campaign-briefs.service";
import { LeaveReviewButton } from "@/components/brand-marketing/leave-review-button";
import { ApprovalTrail } from "@/components/brand-marketing/approval-trail";
import { useCurrentUser } from "@/hooks/use-current-user";

interface BriefEditorProps {
  campaignId: string;
  canEdit: boolean;
}

const FIELDS: Array<{
  key: keyof CampaignBriefInput;
  label: string;
  placeholder: string;
  rows: number;
}> = [
  {
    key: "objective",
    label: "Objective",
    placeholder: "What does success look like for this campaign?",
    rows: 2,
  },
  {
    key: "audience",
    label: "Audience + insight",
    placeholder: "Who are we talking to, and what do we know about them right now?",
    rows: 2,
  },
  {
    key: "mandatories",
    label: "Mandatories",
    placeholder: "Claims, legal, brand must-haves, disclaimers.",
    rows: 2,
  },
];

async function fetchBrief(url: string): Promise<CampaignBrief | null> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Failed to load brief");
  return r.json();
}

function emptyInput(): CampaignBriefInput {
  return {
    objective: "",
    audience: "",
    proposition: "",
    mandatories: "",
    successMeasure: "",
    references: [],
  };
}

function fromBrief(brief: CampaignBrief | null): CampaignBriefInput {
  if (!brief) return emptyInput();
  return {
    objective: brief.objective,
    audience: brief.audience,
    proposition: brief.proposition,
    mandatories: brief.mandatories,
    successMeasure: brief.successMeasure,
    references: brief.references,
  };
}

export function BriefEditor({ campaignId, canEdit }: BriefEditorProps) {
  const { data: brief, mutate, isLoading } = useSWR<CampaignBrief | null>(
    `/api/campaign-briefs/${campaignId}`,
    fetchBrief
  );
  const { user } = useCurrentUser();
  const canReview = user?.role === "Brand Marketing Manager" || user?.role === "Admin";
  const { toast } = useToast();
  const [draft, setDraft] = useState<CampaignBriefInput>(emptyInput());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newRefUrl, setNewRefUrl] = useState("");

  useEffect(() => {
    if (!isLoading) {
      setDraft(fromBrief(brief ?? null));
      setDirty(false);
    }
  }, [brief, isLoading]);

  const { filled, total } = briefCompleteness(draft);
  const savedSummary = brief?.updatedAt
    ? `Last saved · v${brief.version}`
    : "Draft";

  function set<K extends keyof CampaignBriefInput>(key: K, value: CampaignBriefInput[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function addReference() {
    const url = newRefUrl.trim();
    if (!url) return;
    set("references", [...draft.references, url]);
    setNewRefUrl("");
  }

  function removeReference(idx: number) {
    set(
      "references",
      draft.references.filter((_, i) => i !== idx)
    );
  }

  async function save() {
    setSaving(true);
    try {
      const r = await fetch(`/api/campaign-briefs/${campaignId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!r.ok) {
        const msg = (await r.json()).error ?? "Failed to save";
        toast("error", `Couldn't save brief: ${msg}`);
        return;
      }
      const saved = (await r.json()) as CampaignBrief;
      mutate(saved, { revalidate: false });
      setDraft(fromBrief(saved));
      setDirty(false);
      toast("success", `Brief saved (v${saved.version})`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader>
        <CardTitle>
          <BookOpen />
          <span>Campaign brief</span>
        </CardTitle>
        <div className="flex items-center gap-3">
          <span
            className={`text-[11px] font-medium tracking-wide ${
              filled === total
                ? "text-success"
                : filled > 0
                  ? "text-warning"
                  : "text-text-tertiary"
            }`}
          >
            {filled} of {total} filled
          </span>
          <span className="text-[11px] text-text-tertiary">{savedSummary}</span>
        </div>
      </CardHeader>

      <div className="px-4 py-4 space-y-5">
        {isLoading ? (
          <p className="text-sm text-text-tertiary">Loading brief...</p>
        ) : (
          <>
            {FIELDS.map((f) => {
              const value = draft[f.key] as string;
              return (
                <div key={f.key} className="space-y-1">
                  <label className="text-sm font-medium text-text-primary">{f.label}</label>
                  {f.rows <= 1 ? (
                    <Input
                      value={value}
                      onChange={(e) => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      disabled={!canEdit}
                    />
                  ) : (
                    <Textarea
                      value={value}
                      onChange={(e) => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      rows={f.rows}
                      disabled={!canEdit}
                    />
                  )}
                </div>
              );
            })}

            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">References</label>
              {draft.references.length > 0 && (
                <ul className="space-y-1 pt-1">
                  {draft.references.map((url, idx) => (
                    <li
                      key={`${url}-${idx}`}
                      className="flex items-center gap-2 text-sm text-text-secondary"
                    >
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-primary hover:underline"
                      >
                        {url}
                      </a>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => removeReference(idx)}
                          className="text-text-tertiary hover:text-error"
                          aria-label="Remove reference"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canEdit && (
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    value={newRefUrl}
                    onChange={(e) => setNewRefUrl(e.target.value)}
                    placeholder="https://..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addReference();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={addReference}>
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
          <span className="text-[11px] text-text-tertiary mr-auto">
            {dirty ? "Unsaved changes" : "Up to date"}
          </span>
          <Button onClick={save} disabled={!dirty || saving}>
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save brief"}
          </Button>
        </div>
      )}

      {brief && (
        <div className="border-t border-border px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
              Brand review
            </h4>
            <LeaveReviewButton
              subjectType="campaign_brief"
              subjectId={brief.id}
              campaignId={campaignId}
              canReview={canReview}
            />
          </div>
          <ApprovalTrail subjectType="campaign_brief" subjectId={brief.id} />
        </div>
      )}
    </Card>
  );
}
