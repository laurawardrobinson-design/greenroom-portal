"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Wand2, PencilLine } from "lucide-react";

interface DeliverableTemplateRow {
  deliverableId: string;
  channel: string;
  format: string;
  width: number;
  height: number;
  quantity: number;
  workflowStage: string;
  templateId: string | null;
  templateName: string | null;
  templateStatus: string | null;
  updatedAt: string | null;
}

interface Response {
  items: DeliverableTemplateRow[];
  summary: { total: number; ready: number; drafting: number; needsTemplate: number };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function stageLabel(stage: string): string {
  if (stage === "needs_template") return "Needs template";
  if (stage === "drafting") return "Drafting";
  if (stage === "template_ready") return "Ready";
  return "Not started";
}

function stageClass(stage: string): string {
  const base = "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider";
  if (stage === "template_ready") return `${base} border-primary/30 bg-primary/10 text-primary`;
  if (stage === "drafting") return `${base} border-amber-400/30 bg-amber-400/10 text-warning dark:text-amber-400`;
  if (stage === "needs_template") return `${base} border-border bg-surface-2 text-text-secondary`;
  return `${base} border-border bg-surface-2 text-text-tertiary`;
}

export function DeliverableTemplatesTile({
  campaignId,
  enableActions = false,
  title = "Deliverables to template",
}: {
  campaignId: string;
  enableActions?: boolean;
  title?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, mutate } = useSWR<Response>(
    `/api/campaigns/${campaignId}/deliverable-templates`,
    fetcher,
    { refreshInterval: 30_000 }
  );

  async function startTemplating(deliverableId: string) {
    setBusyId(deliverableId);
    try {
      const res = await fetch("/api/asset-studio/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverableId, seedDefaultSpecs: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't start templating");
      }
      const template = await res.json();
      toast("success", "Template created — opening editor");
      router.push(`/asset-studio/templates/${template.id}/edit`);
    } catch (err) {
      toast("error", (err as Error).message || "Failed to start templating");
      setBusyId(null);
      mutate();
    }
  }

  if (!data?.items?.length) return null;

  const items = data.items;
  const summary = data.summary ?? { total: 0, ready: 0, drafting: 0, needsTemplate: 0 };
  const pctReady = summary.total > 0 ? Math.round((summary.ready / summary.total) * 100) : 0;

  return (
    <Card padding="none">
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
        <Wand2 className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
          {title}
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-text-tertiary">
          {summary.ready} of {summary.total} ready
        </span>
      </div>

      <div className="border-b border-border px-3.5 py-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pctReady}%` }}
          />
        </div>
        <div className="mt-1 flex gap-3 text-[10px] uppercase tracking-wider text-text-tertiary">
          <span>{summary.needsTemplate} needs template</span>
          <span>{summary.drafting} drafting</span>
          <span>{summary.ready} ready</span>
        </div>
      </div>

      <ul className="divide-y divide-border">
        {items.map((item) => {
          const channelFormat = [item.channel, item.format].filter(Boolean).join(" ") || "Deliverable";
          const sizeLabel = item.width && item.height ? `${item.width}×${item.height}` : "";
          const quantityLabel = item.quantity > 1 ? ` · ${item.quantity} variants` : "";

          return (
            <li key={item.deliverableId} className="flex items-center gap-3 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-text-primary">{channelFormat}</span>
                  {sizeLabel && (
                    <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                      {sizeLabel}
                    </span>
                  )}
                  <span className={stageClass(item.workflowStage)}>
                    {stageLabel(item.workflowStage)}
                  </span>
                </div>
                {quantityLabel && (
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-text-tertiary">
                    {quantityLabel.replace(" · ", "")}
                  </p>
                )}
              </div>

              {item.templateId ? (
                <Link
                  href={`/asset-studio/templates/${item.templateId}/edit`}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    enableActions
                      ? "border border-primary bg-primary text-white hover:bg-primary/90"
                      : "border border-border bg-surface-2 text-text-primary hover:border-primary hover:text-primary"
                  }`}
                >
                  <PencilLine className="h-3 w-3" />
                  Open template
                </Link>
              ) : enableActions ? (
                <Button
                  size="sm"
                  variant="primary"
                  loading={busyId === item.deliverableId}
                  onClick={() => startTemplating(item.deliverableId)}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Start templating
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
