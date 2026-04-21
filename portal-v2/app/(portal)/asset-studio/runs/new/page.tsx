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
  MousePointerClick,
  FileText,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Languages,
} from "lucide-react";

// Locales offered in the run builder. "en-US" is always selected and represents
// the default (layer.staticValue) — it isn't toggleable. Additional codes map
// to per-layer translations in template_layers.locales.
const RUN_LOCALE_OPTIONS = [
  { code: "en-US", label: "English (US)", required: true },
  { code: "es-US", label: "Spanish (US)", required: false },
  { code: "fr-CA", label: "French (Canada)", required: false },
  { code: "pt-BR", label: "Portuguese (Brazil)", required: false },
] as const;

const ALLOWED_ROLES = ["Admin", "Producer", "Post Producer", "Designer"];

export default function NewRunPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const initialTemplateId = searchParams.get("templateId") ?? "";
  const initialCampaignId = searchParams.get("campaignId") ?? "";

  const [templateId, setTemplateId] = useState<string>(initialTemplateId);
  const [campaignId, setCampaignId] = useState<string>(initialCampaignId);
  const [runName, setRunName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedSpecs, setSelectedSpecs] = useState<Set<string>>(new Set());
  const [copyOverrides, setCopyOverrides] = useState<Record<string, string>>({});
  // Per-row copy overrides keyed by campaign_product_id → { bindingPath → text }.
  // Merged on top of the global copyOverrides when the run is created.
  const [perProductCopy, setPerProductCopy] = useState<
    Record<string, Record<string, string>>
  >({});
  // Per-campaign-product image overrides (cp.id → DAM asset file URL). When set,
  // the variant uses this image instead of the default product-on-white shot.
  const [imageOverrides, setImageOverrides] = useState<Record<string, string>>({});
  const [showPerRow, setShowPerRow] = useState(false);
  // Locale codes to render. en-US is always present; others are toggleable.
  const [selectedLocales, setSelectedLocales] = useState<Set<string>>(
    new Set(["en-US"])
  );
  const [submitting, setSubmitting] = useState(false);
  const [productPickerMode, setProductPickerMode] = useState<
    "grid" | "csv" | "upload"
  >("grid");
  const [bulkInput, setBulkInput] = useState<string>("");
  const [bulkError, setBulkError] = useState<string>("");
  // CSV upload state
  const [csvText, setCsvText] = useState<string>("");
  const [csvFileName, setCsvFileName] = useState<string>("");
  const [csvPreview, setCsvPreview] = useState<{
    headers: string[];
    productKeyHeader: string;
    bindingHeaders: string[];
    ignoredHeaders: string[];
    matched: Array<{
      rowIndex: number;
      rawKey: string;
      matchedVia: "uuid" | "item_code" | "name" | null;
      campaignProductId: string | null;
      productName: string | null;
      copy: Record<string, string>;
    }>;
    unmatched: Array<{
      rowIndex: number;
      rawKey: string;
      matchedVia: null;
      campaignProductId: null;
      productName: null;
      copy: Record<string, string>;
    }>;
    warnings: string[];
  } | null>(null);
  const [csvParsing, setCsvParsing] = useState(false);
  const [csvError, setCsvError] = useState<string>("");

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
  // Campaign-scoped DAM assets — photographer-uploaded shoot images tagged to
  // this campaign (and optionally to a SKU). Designers can pick one to swap in
  // for a product's default on-white shot when building the run.
  const { data: damLibrary } = useSWR<{
    assets: Array<{
      id: string;
      name: string;
      fileUrl: string;
      fileType: string;
      productSkus?: string[];
    }>;
  }>(
    campaignId
      ? `/api/asset-studio/dam-assets?includeSources=false&campaignId=${campaignId}`
      : null,
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

  // Clear product selection and image overrides when campaign changes
  useEffect(() => {
    setSelectedProducts(new Set());
    setImageOverrides({});
  }, [campaignId]);

  // Prefill copy overrides from campaign-level copy when template + campaign
  // are picked. Maps bindings whose last segment is headline/cta/disclaimer/legal
  // to the corresponding campaign field. Does not overwrite values the user
  // has already typed — only fills empty slots.
  const campaign = campaigns?.find((c) => c.id === campaignId);
  useEffect(() => {
    if (!campaign || !templateDetail?.layers) return;
    const campaignCopy: Record<string, string> = {
      headline: campaign.headline ?? "",
      cta: campaign.cta ?? "",
      disclaimer: campaign.disclaimer ?? "",
      legal: campaign.legal ?? "",
    };
    const dynamicBindings = templateDetail.layers
      .filter((l) => l.layerType === "text" && l.isDynamic && l.dataBinding)
      .map((l) => l.dataBinding);

    setCopyOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const binding of dynamicBindings) {
        if (!binding) continue;
        const last = binding.split(".").pop()?.toLowerCase() ?? "";
        const candidate = campaignCopy[last];
        if (candidate && !(next[binding] ?? "").trim()) {
          next[binding] = candidate;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [campaign?.id, campaign?.headline, campaign?.cta, campaign?.disclaimer, campaign?.legal, templateDetail?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const totalVariants =
    selectedProducts.size * selectedSpecs.size * selectedLocales.size;
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
      // Strip empty/whitespace cells from per-row overrides, and drop rows for
      // products that aren't selected. Only send a non-empty dict.
      const cleanedPerRow: Record<string, Record<string, string>> = {};
      for (const [cpId, fields] of Object.entries(perProductCopy)) {
        if (!selectedProducts.has(cpId)) continue;
        const nonEmpty = Object.fromEntries(
          Object.entries(fields).filter(([, v]) => v && v.trim() !== "")
        );
        if (Object.keys(nonEmpty).length > 0) cleanedPerRow[cpId] = nonEmpty;
      }
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
            locale_codes: Array.from(selectedLocales),
            copy_overrides:
              Object.keys(cleanedOverrides).length > 0
                ? cleanedOverrides
                : undefined,
            copy_overrides_by_product:
              Object.keys(cleanedPerRow).length > 0 ? cleanedPerRow : undefined,
            image_overrides_by_product: (() => {
              const cleaned: Record<string, string> = {};
              for (const [cpId, url] of Object.entries(imageOverrides)) {
                if (selectedProducts.has(cpId) && url) cleaned[cpId] = url;
              }
              return Object.keys(cleaned).length > 0 ? cleaned : undefined;
            })(),
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
        try {
          const renderRes = await fetch(`/api/asset-studio/runs/${run.id}/render`, {
            method: "POST",
          });
          if (!renderRes.ok) {
            const body = await renderRes.json().catch(() => ({}));
            toast(
              "info",
              body.error
                ? `Run created, but render did not start: ${body.error}`
                : "Run created, but render did not start automatically."
            );
          }
        } catch {
          toast(
            "info",
            "Run created, but render did not start automatically."
          );
        }
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
              <div className="flex items-center gap-2">
                {campaignProducts && campaignProducts.length > 0 && productPickerMode === "grid" && (
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
                <div className="flex items-center overflow-hidden rounded-md border border-[var(--as-border)] text-[11px]">
                  <button
                    type="button"
                    onClick={() => setProductPickerMode("grid")}
                    className={`flex items-center gap-1 px-2 py-1 font-medium ${
                      productPickerMode === "grid"
                        ? "bg-[var(--as-accent-soft)] text-[var(--as-accent)]"
                        : "text-[var(--as-text-muted)] hover:bg-[var(--as-surface-2)]"
                    }`}
                    aria-label="Grid picker"
                  >
                    <MousePointerClick className="h-3 w-3" />
                    Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductPickerMode("csv")}
                    className={`flex items-center gap-1 px-2 py-1 font-medium ${
                      productPickerMode === "csv"
                        ? "bg-[var(--as-accent-soft)] text-[var(--as-accent)]"
                        : "text-[var(--as-text-muted)] hover:bg-[var(--as-surface-2)]"
                    }`}
                    aria-label="Paste list"
                  >
                    <FileText className="h-3 w-3" />
                    Paste list
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductPickerMode("upload")}
                    className={`flex items-center gap-1 px-2 py-1 font-medium ${
                      productPickerMode === "upload"
                        ? "bg-[var(--as-accent-soft)] text-[var(--as-accent)]"
                        : "text-[var(--as-text-muted)] hover:bg-[var(--as-surface-2)]"
                    }`}
                    aria-label="CSV upload"
                  >
                    <Upload className="h-3 w-3" />
                    CSV upload
                  </button>
                </div>
              </div>
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
            ) : productPickerMode === "grid" ? (
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
            ) : productPickerMode === "csv" ? (
              <div className="space-y-2">
                <p className="text-[11px] text-[var(--as-text-subtle)]">
                  Paste one product per line — by SKU/item code, product name, or UUID.
                  We&apos;ll match each line against this campaign&apos;s linked products.
                </p>
                <Textarea
                  value={bulkInput}
                  onChange={(e) => {
                    setBulkInput(e.target.value);
                    setBulkError("");
                  }}
                  placeholder="001234\n001235\nBerry Chantilly Cake\n…"
                  rows={6}
                  className="font-mono text-xs"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-[var(--as-text-subtle)]">
                    {selectedProducts.size > 0
                      ? `${selectedProducts.size} matched`
                      : "No matches yet"}
                    {bulkError && (
                      <span className="ml-2 text-[var(--as-status-failed)]">· {bulkError}</span>
                    )}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const lines = bulkInput
                        .split(/[\n,]+/)
                        .map((l) => l.trim())
                        .filter(Boolean);
                      if (lines.length === 0) {
                        setBulkError("Nothing to parse");
                        return;
                      }
                      const matched = new Set<string>();
                      const missed: string[] = [];
                      for (const line of lines) {
                        const lc = line.toLowerCase();
                        const cp = campaignProducts.find((cp) => {
                          if (cp.id === line) return true;
                          if (cp.productId === line) return true;
                          const p = cp.product;
                          if (!p) return false;
                          if (p.id === line) return true;
                          if ((p.itemCode ?? "").toLowerCase() === lc) return true;
                          if ((p.name ?? "").toLowerCase() === lc) return true;
                          return false;
                        });
                        if (cp) matched.add(cp.id);
                        else missed.push(line);
                      }
                      setSelectedProducts(matched);
                      setBulkError(
                        missed.length > 0
                          ? `${missed.length} unmatched (${missed.slice(0, 3).join(", ")}${missed.length > 3 ? ", …" : ""})`
                          : ""
                      );
                    }}
                  >
                    Match {bulkInput.trim() ? `(${bulkInput.split(/[\n,]+/).filter((s) => s.trim()).length})` : ""}
                  </Button>
                </div>
              </div>
            ) : (
              // CSV upload branch — full Storyteq Batch Creator parity.
              <div className="space-y-3">
                <p className="text-[11px] text-[var(--as-text-subtle)]">
                  Upload a CSV with a header row. First column = product key
                  (SKU, name, or UUID). Remaining columns = dynamic binding
                  paths (e.g.{" "}
                  {dynamicTextBindings.length > 0 ? (
                    <code className="rounded bg-[var(--as-surface-2)] px-1 py-0.5">
                      {dynamicTextBindings[0]}
                    </code>
                  ) : (
                    <code className="rounded bg-[var(--as-surface-2)] px-1 py-0.5">
                      product.name
                    </code>
                  )}
                  ) — each row sets per-product copy overrides automatically.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[var(--as-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--as-layer-hover)]">
                    <Upload className="h-3.5 w-3.5" />
                    {csvFileName ? "Replace file…" : "Choose CSV file…"}
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 1_000_000) {
                          setCsvError("File is over 1 MB — please split it.");
                          return;
                        }
                        const text = await f.text();
                        setCsvFileName(f.name);
                        setCsvText(text);
                        setCsvPreview(null);
                        setCsvError("");
                      }}
                    />
                  </label>
                  {csvFileName && (
                    <span className="text-[11px] text-[var(--as-text-muted)]">
                      {csvFileName}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!csvText || !templateId || !campaignId || csvParsing}
                    loading={csvParsing}
                    onClick={async () => {
                      setCsvParsing(true);
                      setCsvError("");
                      try {
                        const res = await fetch(
                          "/api/asset-studio/runs/parse-csv",
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              templateId,
                              campaignId,
                              csvText,
                            }),
                          }
                        );
                        const body = await res.json();
                        if (!res.ok) {
                          throw new Error(body.error ?? "Parse failed");
                        }
                        setCsvPreview(body);
                      } catch (err) {
                        setCsvError((err as Error).message);
                      } finally {
                        setCsvParsing(false);
                      }
                    }}
                  >
                    Parse & preview
                  </Button>
                  {csvPreview && csvPreview.matched.length > 0 && (
                    <Button
                      size="sm"
                      onClick={() => {
                        // Apply matched rows to state
                        const sel = new Set<string>();
                        const copyMap: Record<string, Record<string, string>> = {};
                        for (const row of csvPreview.matched) {
                          if (!row.campaignProductId) continue;
                          sel.add(row.campaignProductId);
                          if (Object.keys(row.copy).length > 0) {
                            copyMap[row.campaignProductId] = row.copy;
                          }
                        }
                        setSelectedProducts(sel);
                        setPerProductCopy((prev) => ({ ...prev, ...copyMap }));
                        // Expand per-row card so user sees what landed
                        if (Object.keys(copyMap).length > 0) setShowPerRow(true);
                        toast(
                          "success",
                          `Applied ${sel.size} product${sel.size === 1 ? "" : "s"}${
                            Object.keys(copyMap).length > 0
                              ? ` and ${Object.keys(copyMap).length} copy override row${Object.keys(copyMap).length === 1 ? "" : "s"}`
                              : ""
                          }`
                        );
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Apply {csvPreview.matched.length} match
                      {csvPreview.matched.length === 1 ? "" : "es"}
                    </Button>
                  )}
                </div>
                {csvError && (
                  <p className="flex items-center gap-1 text-[11px] text-[var(--as-status-failed)]">
                    <AlertTriangle className="h-3 w-3" />
                    {csvError}
                  </p>
                )}
                {csvPreview && (
                  <div className="rounded-lg border border-[var(--as-border)] bg-[var(--as-surface-2)] p-3 text-[11px]">
                    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[var(--as-text)]">
                      <span>
                        <strong className="text-[var(--as-accent)]">
                          {csvPreview.matched.length}
                        </strong>{" "}
                        matched
                      </span>
                      <span>
                        <strong
                          className={
                            csvPreview.unmatched.length > 0
                              ? "text-[var(--as-status-failed)]"
                              : "text-[var(--as-text-muted)]"
                          }
                        >
                          {csvPreview.unmatched.length}
                        </strong>{" "}
                        unmatched
                      </span>
                      <span className="text-[var(--as-text-muted)]">
                        Copy columns:{" "}
                        {csvPreview.bindingHeaders.length > 0
                          ? csvPreview.bindingHeaders.join(", ")
                          : "none"}
                      </span>
                    </div>
                    {csvPreview.ignoredHeaders.length > 0 && (
                      <p className="mb-1 text-[var(--as-text-muted)]">
                        Ignored headers: {csvPreview.ignoredHeaders.join(", ")}
                      </p>
                    )}
                    {csvPreview.warnings.map((w, i) => (
                      <p key={i} className="text-[var(--as-status-failed)]">
                        · {w}
                      </p>
                    ))}
                    {csvPreview.unmatched.length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[var(--as-text-muted)]">
                          Show unmatched
                        </summary>
                        <ul className="ml-3 mt-1 list-disc space-y-0.5 text-[var(--as-text-muted)]">
                          {csvPreview.unmatched.slice(0, 20).map((r) => (
                            <li key={r.rowIndex}>
                              row {r.rowIndex}: “{r.rawKey}”
                            </li>
                          ))}
                          {csvPreview.unmatched.length > 20 && (
                            <li>… and {csvPreview.unmatched.length - 20} more</li>
                          )}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Step 3b: Campaign DAM images (optional image overrides) */}
          {campaignId && (damLibrary?.assets?.length ?? 0) > 0 && (
            <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
              <StepHeader n={3.5} title="Campaign DAM" />
              <p className="text-[11px] text-[var(--as-text-subtle)] mb-2">
                Shoot images uploaded to this campaign. Click to swap in for matching
                products; products without an override use the default on-white shot.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {(damLibrary?.assets ?? [])
                  .filter((a) => (a.fileType || "").startsWith("image/"))
                  .map((asset) => {
                    const skuTags = asset.productSkus ?? [];
                    const matchingCps = (campaignProducts ?? []).filter((cp) => {
                      const code = cp.product?.itemCode ?? "";
                      return skuTags.includes(code);
                    });
                    const appliedToCount = matchingCps.filter(
                      (cp) => imageOverrides[cp.id] === asset.fileUrl
                    ).length;
                    const allApplied =
                      matchingCps.length > 0 && appliedToCount === matchingCps.length;

                    return (
                      <div
                        key={asset.id}
                        className="rounded-lg border border-[var(--as-border)] bg-[var(--as-surface-2)] overflow-hidden"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={asset.fileUrl}
                          alt={asset.name}
                          className="h-24 w-full object-cover"
                        />
                        <div className="p-2 space-y-1.5">
                          <p className="truncate text-[11px] text-[var(--as-text)]">
                            {asset.name}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {skuTags.length === 0 ? (
                              <span className="text-[10px] italic text-[var(--as-text-subtle)]">
                                Untagged
                              </span>
                            ) : (
                              skuTags.slice(0, 3).map((sku) => (
                                <span
                                  key={sku}
                                  className="rounded-full bg-[var(--as-surface)] border border-[var(--as-border)] px-1.5 text-[10px] text-[var(--as-text-muted)]"
                                >
                                  {sku}
                                </span>
                              ))
                            )}
                          </div>
                          {matchingCps.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setImageOverrides((prev) => {
                                  const next = { ...prev };
                                  for (const cp of matchingCps) {
                                    if (allApplied) delete next[cp.id];
                                    else next[cp.id] = asset.fileUrl;
                                  }
                                  return next;
                                });
                                // Ensure those products are selected so overrides apply.
                                if (!allApplied) {
                                  setSelectedProducts((prev) => {
                                    const next = new Set(prev);
                                    for (const cp of matchingCps) next.add(cp.id);
                                    return next;
                                  });
                                }
                              }}
                              className={`w-full rounded-md border px-2 py-1 text-[11px] transition-colors ${
                                allApplied
                                  ? "border-[var(--as-accent)] bg-[var(--as-accent-soft)] text-[var(--as-accent)]"
                                  : "border-[var(--as-border)] hover:bg-[var(--as-layer-hover)]"
                              }`}
                            >
                              {allApplied
                                ? `Applied to ${matchingCps.length} · click to undo`
                                : `Apply to ${matchingCps.length} matching`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
              {Object.keys(imageOverrides).length > 0 && (
                <p className="mt-2 text-[11px] text-[var(--as-text-subtle)]">
                  {Object.keys(imageOverrides).length} product(s) using a DAM image
                  instead of the on-white shot.{" "}
                  <button
                    type="button"
                    onClick={() => setImageOverrides({})}
                    className="underline hover:text-[var(--as-text)]"
                  >
                    Clear all
                  </button>
                </p>
              )}
            </Card>
          )}

          {/* Step 4: Output sizes + locales (both control the fan-out matrix) */}
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

            {/* Locales — same fan-out dimension as specs, so they share the step. */}
            <div className="mt-4 border-t border-[var(--as-border)] pt-4">
              <div className="mb-2 flex items-center gap-2">
                <Languages className="h-3.5 w-3.5 text-[var(--as-text-muted)]" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--as-text-muted)]">
                  Locales
                </h3>
                <span className="text-[11px] text-[var(--as-text-subtle)]">
                  multiplies variant count
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {RUN_LOCALE_OPTIONS.map(({ code, label, required }) => {
                  const selected = selectedLocales.has(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      disabled={required}
                      onClick={() => {
                        if (required) return;
                        setSelectedLocales((prev) => {
                          const next = new Set(prev);
                          if (next.has(code)) next.delete(code);
                          else next.add(code);
                          return next;
                        });
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                        selected
                          ? "border-[var(--as-accent)] bg-[var(--as-accent-soft)] text-[var(--as-accent)]"
                          : "border-[var(--as-border)] text-[var(--as-text-muted)] hover:bg-[var(--as-layer-hover)]"
                      } ${required ? "cursor-default" : "cursor-pointer"}`}
                      title={required ? "Always included" : undefined}
                    >
                      <span className="font-mono text-[10px]">{code}</span>
                      <span>{label}</span>
                      {selected && !required && <CheckSquare className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] text-[var(--as-text-subtle)]">
                Non-default locales pull translated text from the template&apos;s
                layer translations and fall back to the default when a translation
                is missing.
              </p>
            </div>
          </Card>

          {/* Step 5: Copy overrides (optional) */}
          {dynamicTextBindings.length > 0 && (
            <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
              <StepHeader n={5} title="Global copy overrides (optional)" />
              <p className="mb-3 text-xs text-[var(--as-text-muted)]">
                Leave blank to use each product&apos;s field value. Overrides apply to
                every variant in this run unless a per-row override is set in step 6.
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

          {/* Step 6: Per-row copy overrides (optional, requires selected products + dynamic bindings) */}
          {dynamicTextBindings.length > 0 && selectedProducts.size > 0 && (
            <Card padding="lg" className="border-[var(--as-border)] bg-[var(--as-surface)]">
              <div className="flex items-center justify-between">
                <StepHeader n={6} title="Per-row copy overrides (optional)" />
                <button
                  type="button"
                  onClick={() => setShowPerRow((v) => !v)}
                  className="text-xs font-medium text-[var(--as-accent)] hover:underline"
                >
                  {showPerRow ? "Hide" : `Edit ${selectedProducts.size} row${selectedProducts.size === 1 ? "" : "s"}`}
                </button>
              </div>
              <p className="mb-3 text-xs text-[var(--as-text-muted)]">
                Set different copy for individual products — the Storyteq Batch Creator
                pattern. Overrides here win over the global copy in step 5.
              </p>
              {showPerRow && (
                <div className="overflow-x-auto rounded-lg border border-[var(--as-border)]">
                  <table className="w-full text-xs">
                    <thead className="bg-[var(--as-surface-2)] text-[var(--as-text-muted)]">
                      <tr>
                        <th className="sticky left-0 z-10 bg-[var(--as-surface-2)] px-3 py-2 text-left font-semibold">
                          Product
                        </th>
                        {dynamicTextBindings.map((b) => (
                          <th
                            key={b}
                            className="min-w-[160px] px-2 py-2 text-left font-semibold"
                          >
                            <code className="rounded bg-[var(--as-surface)] px-1 py-0.5 text-[11px]">
                              {b}
                            </code>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(campaignProducts ?? [])
                        .filter((cp) => selectedProducts.has(cp.id))
                        .map((cp) => {
                          const rowCopy = perProductCopy[cp.id] ?? {};
                          const p = cp.product;
                          return (
                            <tr key={cp.id} className="border-t border-[var(--as-border)]">
                              <td className="sticky left-0 z-10 bg-[var(--as-surface)] px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded border border-[var(--as-border)] bg-[var(--as-canvas-bg)]">
                                    {p?.imageUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={p.imageUrl}
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <ImageOff className="h-3.5 w-3.5 text-[var(--as-text-subtle)]" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-[var(--as-text)]">
                                      {p?.name ?? "Unknown"}
                                    </p>
                                    <p className="truncate text-[10px] text-[var(--as-text-subtle)]">
                                      {p?.itemCode ?? ""}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              {dynamicTextBindings.map((b) => (
                                <td key={b} className="px-2 py-2 align-middle">
                                  <Input
                                    value={rowCopy[b] ?? ""}
                                    onChange={(e) =>
                                      setPerProductCopy((prev) => ({
                                        ...prev,
                                        [cp.id]: {
                                          ...(prev[cp.id] ?? {}),
                                          [b]: e.target.value,
                                        },
                                      }))
                                    }
                                    placeholder={
                                      copyOverrides[b] ? `(uses “${copyOverrides[b]}”)` : "(default)"
                                    }
                                    className="h-8 text-xs"
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
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
              <SummaryRow
                label="Locales"
                value={`${selectedLocales.size} (${Array.from(selectedLocales).join(", ")})`}
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
