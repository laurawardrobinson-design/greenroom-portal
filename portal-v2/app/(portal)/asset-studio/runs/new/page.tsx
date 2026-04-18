"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useToast } from "@/components/ui/toast";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetcher } from "@/components/asset-studio/lib";
import type {
  AssetTemplate,
  Campaign,
  CampaignProduct,
  TemplateOutputSpec,
  VariantRun,
} from "@/types/domain";
import {
  ArrowLeft,
  CheckSquare,
  Square,
  ImageOff,
  PlayCircle,
  Sparkles,
} from "lucide-react";

const ALLOWED_ROLES = ["Admin", "Producer", "Post Producer", "Designer"];

export default function NewRunPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const initialTemplateId = searchParams.get("templateId") ?? "";

  const [templateId, setTemplateId] = useState<string>(initialTemplateId);
  const [campaignId, setCampaignId] = useState<string>("");
  const [runName, setRunName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedSpecs, setSelectedSpecs] = useState<Set<string>>(new Set());
  const [copyOverrides, setCopyOverrides] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // ── Data sources ──────────────────────────────────────────────────────────
  const { data: templates } = useSWR<AssetTemplate[]>(
    "/api/asset-studio/templates?status=published",
    fetcher
  );
  const { data: allTemplates } = useSWR<AssetTemplate[]>(
    "/api/asset-studio/templates",
    fetcher
  );
  const { data: campaigns } = useSWR<Campaign[]>("/api/campaigns", fetcher);
  const { data: templateDetail } = useSWR<AssetTemplate>(
    templateId ? `/api/asset-studio/templates/${templateId}` : null,
    fetcher
  );
  const { data: campaignProducts } = useSWR<CampaignProduct[]>(
    campaignId ? `/api/campaign-products?campaignId=${campaignId}` : null,
    fetcher
  );

  // Default-select all output specs when template loads
  useEffect(() => {
    if (templateDetail?.outputSpecs) {
      setSelectedSpecs(new Set(templateDetail.outputSpecs.map((s) => s.id)));
    }
  }, [templateDetail?.id, templateDetail?.outputSpecs]);

  // Pre-fill run name when template/campaign chosen
  useEffect(() => {
    if (templateDetail && !runName) {
      const campaign = campaigns?.find((c) => c.id === campaignId);
      const tag = campaign
        ? `${campaign.wfNumber || campaign.name}`
        : new Date().toLocaleDateString();
      setRunName(`${templateDetail.name} — ${tag}`);
    }
  }, [templateDetail?.id, campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear product selection when campaign changes
  useEffect(() => {
    setSelectedProducts(new Set());
  }, [campaignId]);

  // Gather dynamic text layers so we can expose copy_overrides UI
  const dynamicTextBindings = useMemo(() => {
    if (!templateDetail?.layers) return [] as string[];
    return Array.from(
      new Set(
        templateDetail.layers
          .filter(
            (l) =>
              l.layerType === "text" &&
              l.isDynamic &&
              l.dataBinding &&
              l.dataBinding.trim() !== ""
          )
          .map((l) => l.dataBinding)
      )
    );
  }, [templateDetail?.layers]);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (userLoading || !user) return <DashboardSkeleton />;
  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <EmptyState
        title="Access restricted"
        description="Runs can be created by Designers, Producers, Post Producers, and Admins."
      />
    );
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const templateList = templates ?? [];
  // If the user arrived with a ?templateId= that isn't published, still allow it
  // so they can see the selected template in the picker.
  const selectedTemplate =
    templateList.find((t) => t.id === templateId) ??
    allTemplates?.find((t) => t.id === templateId) ??
    null;
  const specs = templateDetail?.outputSpecs ?? [];
  const totalVariants = selectedProducts.size * selectedSpecs.size;
  const canSubmit =
    Boolean(templateId) &&
    Boolean(runName.trim()) &&
    selectedProducts.size > 0 &&
    selectedSpecs.size > 0 &&
    !submitting;

  // ── Handlers ──────────────────────────────────────────────────────────────
  function toggleProduct(id: string) {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllProducts() {
    if (!campaignProducts) return;
    if (selectedProducts.size === campaignProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(campaignProducts.map((p) => p.id)));
    }
  }
  function toggleSpec(id: string) {
    setSelectedSpecs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(kickOff: boolean) {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const cleanedOverrides = Object.fromEntries(
        Object.entries(copyOverrides).filter(([, v]) => v && v.trim() !== "")
      );
      const res = await fetch("/api/asset-studio/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          campaignId: campaignId || null,
          name: runName.trim(),
          notes: notes.trim() || undefined,
          bindings: {
            campaign_product_ids: Array.from(selectedProducts),
            output_spec_ids: Array.from(selectedSpecs),
            copy_overrides:
              Object.keys(cleanedOverrides).length > 0
                ? cleanedOverrides
                : undefined,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create run");
      }
      const run = (await res.json()) as VariantRun;
      toast("success", `Run created · ${run.totalVariants} variants queued`);

      if (kickOff) {
        // Fire-and-forget render kick; users see progress on detail page.
        fetch(`/api/asset-studio/runs/${run.id}/render`, { method: "POST" }).catch(
          () => {}
        );
      }
      router.push(`/asset-studio/runs/${run.id}`);
    } catch (err) {
      console.error(err);
      toast("error", (err as Error).message ?? "Failed to create run");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5" data-area="asset-studio">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/asset-studio?tab=runs"
            className="mb-1 inline-flex items-center gap-1 text-xs text-[var(--as-text-muted)] hover:text-[var(--as-text)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to runs
          </Link>
          <h1 className="text-2xl font-bold text-[var(--as-text)]">New run</h1>
          <p className="text-sm text-[var(--as-text-muted)]">
            Pick a template, a campaign, and the products you want to render.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Step 1: Template */}
          <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
            <StepHeader n={1} title="Template" />
            {!templateList.length ? (
              <EmptyState
                title="No published templates"
                description="Publish a template to use it for a run."
              />
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {templateList.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateId(t.id)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      templateId === t.id
                        ? "border-[var(--as-accent)] bg-[var(--as-accent-soft)]"
                        : "border-[var(--as-border)] hover:bg-[var(--as-layer-hover)]"
                    }`}
                  >
                    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded border border-[var(--as-border)] bg-[var(--as-canvas-bg)]">
                      {t.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageOff className="h-5 w-5 text-[var(--as-text-subtle)]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--as-text)]">
                        {t.name}
                      </p>
                      <p className="truncate text-xs text-[var(--as-text-muted)]">
                        {t.canvasWidth}×{t.canvasHeight}
                        {t.category ? ` · ${t.category}` : ""}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedTemplate && (
              <p className="mt-3 text-xs text-[var(--as-text-subtle)]">
                Open in{" "}
                <Link
                  href={`/asset-studio/templates/${selectedTemplate.id}/edit`}
                  className="text-[var(--as-accent)] underline-offset-2 hover:underline"
                >
                  template builder
                </Link>
                .
              </p>
            )}
          </Card>

          {/* Step 2: Campaign */}
          <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
            <StepHeader n={2} title="Campaign" />
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="block w-full rounded-lg border border-[var(--as-border)] bg-[var(--as-surface)] px-3.5 py-2.5 text-sm text-[var(--as-text)] focus:border-[var(--as-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--as-accent)]"
              aria-label="Campaign"
            >
              <option value="">Select a campaign…</option>
              {(campaigns ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.wfNumber ? `${c.wfNumber} · ` : ""}
                  {c.name}
                  {c.status ? ` (${c.status})` : ""}
                </option>
              ))}
            </select>
            {!campaignId && (
              <p className="mt-2 text-xs text-[var(--as-text-subtle)]">
                Choosing a campaign scopes product selection to items already linked to it.
              </p>
            )}
          </Card>

          {/* Step 3: Products */}
          <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
            <div className="flex items-center justify-between">
              <StepHeader n={3} title="Products" />
              {campaignProducts && campaignProducts.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllProducts}
                  className="text-xs font-medium text-[var(--as-text-muted)] hover:text-[var(--as-text)]"
                >
                  {selectedProducts.size === campaignProducts.length
                    ? "Clear selection"
                    : "Select all"}
                </button>
              )}
            </div>
            {!campaignId ? (
              <p className="text-sm text-[var(--as-text-muted)]">
                Pick a campaign first to see linked products.
              </p>
            ) : !campaignProducts ? (
              <div className="h-24 animate-pulse rounded-md border border-[var(--as-border)] bg-[var(--as-surface-2)]" />
            ) : campaignProducts.length === 0 ? (
              <EmptyState
                title="No products linked to this campaign"
                description="Link products in the campaign's Products tab, then come back to create a run."
              />
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                {campaignProducts.map((cp) => {
                  const selected = selectedProducts.has(cp.id);
                  const p = cp.product;
                  return (
                    <button
                      key={cp.id}
                      type="button"
                      onClick={() => toggleProduct(cp.id)}
                      className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                        selected
                          ? "border-[var(--as-accent)] bg-[var(--as-accent-soft)]"
                          : "border-[var(--as-border)] hover:bg-[var(--as-layer-hover)]"
                      }`}
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded border border-[var(--as-border)] bg-[var(--as-canvas-bg)]">
                        {p?.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageOff className="h-4 w-4 text-[var(--as-text-subtle)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-[var(--as-text)]">
                          {p?.name ?? "Unknown product"}
                        </p>
                        <p className="truncate text-[11px] text-[var(--as-text-subtle)]">
                          {p?.department ?? ""}
                          {p?.itemCode ? ` · ${p.itemCode}` : ""}
                        </p>
                      </div>
                      {selected ? (
                        <CheckSquare className="h-4 w-4 shrink-0 text-[var(--as-accent)]" />
                      ) : (
                        <Square className="h-4 w-4 shrink-0 text-[var(--as-text-subtle)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Step 4: Output specs */}
          <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
            <StepHeader n={4} title="Output sizes" />
            {!templateId ? (
              <p className="text-sm text-[var(--as-text-muted)]">
                Pick a template to see its output sizes.
              </p>
            ) : specs.length === 0 ? (
              <p className="text-sm text-[var(--as-text-muted)]">
                This template has no output sizes configured. Add sizes in the template
                builder.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {specs.map((s: TemplateOutputSpec) => {
                  const selected = selectedSpecs.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSpec(s.id)}
                      className={`rounded-lg border p-2.5 text-left transition-colors ${
                        selected
                          ? "border-[var(--as-accent)] bg-[var(--as-accent-soft)]"
                          : "border-[var(--as-border)] hover:bg-[var(--as-layer-hover)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--as-text)]">
                            {s.label}
                          </p>
                          <p className="text-[11px] text-[var(--as-text-subtle)]">
                            {s.width}×{s.height}
                            {s.channel ? ` · ${s.channel}` : ""} · {s.format}
                          </p>
                        </div>
                        {selected ? (
                          <CheckSquare className="h-4 w-4 shrink-0 text-[var(--as-accent)]" />
                        ) : (
                          <Square className="h-4 w-4 shrink-0 text-[var(--as-text-subtle)]" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Step 5: Copy overrides (optional) */}
          {dynamicTextBindings.length > 0 && (
            <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
              <StepHeader n={5} title="Copy overrides (optional)" />
              <p className="mb-3 text-xs text-[var(--as-text-muted)]">
                Leave blank to use each product&apos;s field value. Overrides apply to
                every variant in this run.
              </p>
              <div className="space-y-2">
                {dynamicTextBindings.map((binding) => (
                  <div
                    key={binding}
                    className="grid grid-cols-[160px_1fr] items-center gap-3"
                  >
                    <label className="text-xs font-medium text-[var(--as-text-muted)]">
                      <code className="rounded bg-[var(--as-surface-2)] px-1 py-0.5 text-[11px]">
                        {binding}
                      </code>
                    </label>
                    <Input
                      value={copyOverrides[binding] ?? ""}
                      onChange={(e) =>
                        setCopyOverrides((prev) => ({
                          ...prev,
                          [binding]: e.target.value,
                        }))
                      }
                      placeholder={`Override for ${binding}`}
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right rail: summary + submit */}
        <div className="space-y-4">
          <Card padding="lg" className="sticky top-4 border-[var(--as-border)] bg-[var(--as-surface)]">
            <h3 className="mb-3 text-sm font-semibold text-[var(--as-text)]">
              Run summary
            </h3>
            <Input
              label="Run name"
              value={runName}
              onChange={(e) => setRunName(e.target.value)}
              placeholder="e.g. WF-1234 Spring promo — Meta"
            />
            <div className="mt-3">
              <Textarea
                label="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything the approver should know…"
                rows={3}
              />
            </div>

            <div className="mt-4 space-y-1.5 rounded-lg border border-[var(--as-border)] bg-[var(--as-surface-2)] p-3 text-xs text-[var(--as-text)]">
              <SummaryRow
                label="Template"
                value={selectedTemplate?.name ?? "—"}
              />
              <SummaryRow
                label="Campaign"
                value={
                  campaigns?.find((c) => c.id === campaignId)?.name ?? "—"
                }
              />
              <SummaryRow
                label="Products"
                value={`${selectedProducts.size} selected`}
              />
              <SummaryRow
                label="Output sizes"
                value={`${selectedSpecs.size} / ${specs.length}`}
              />
              <div className="mt-2 border-t border-[var(--as-border)] pt-2">
                <SummaryRow
                  label="Variants to render"
                  value={
                    <span className="font-semibold text-[var(--as-text)]">
                      {totalVariants}
                    </span>
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <Button
                onClick={() => submit(true)}
                disabled={!canSubmit}
                loading={submitting}
              >
                <Sparkles className="h-4 w-4" />
                Create & render now
              </Button>
              <Button
                variant="outline"
                onClick={() => submit(false)}
                disabled={!canSubmit}
              >
                <PlayCircle className="h-4 w-4" />
                Create as queued
              </Button>
              <Link
                href="/asset-studio?tab=runs"
                className="text-center text-xs text-[var(--as-text-muted)] hover:text-[var(--as-text)]"
              >
                Cancel
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StepHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--as-accent-soft)] text-[11px] font-semibold text-[var(--as-accent)]">
        {n}
      </span>
      <h2 className="text-sm font-semibold text-[var(--as-text)]">{title}</h2>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--as-text-muted)]">{label}</span>
      <span className="truncate text-right">{value}</span>
    </div>
  );
}
