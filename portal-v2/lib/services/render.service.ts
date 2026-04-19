import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTemplate } from "./templates.service";
import { getActiveBrandTokens } from "./brand.service";
import type {
  AssetTemplate,
  TemplateOutputSpec,
  TemplateLayer,
  Variant,
  VariantBindings,
  BrandTokenSet,
} from "@/types/domain";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RenderRunResult {
  runId: string;
  rendered: number;
  failed: number;
  skipped: number;
}

export interface RenderRunVariantEvent {
  variantId: string;
  status: "rendering" | "rendered" | "failed" | "skipped";
  errorMessage?: string;
}

export interface RenderRunOptions {
  variantIds?: string[];
  onVariantStatus?: (event: RenderRunVariantEvent) => Promise<void> | void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(value: number, total: number): number {
  return Math.round((value / 100) * total);
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case '"': return "&quot;";
      case "'": return "&apos;";
      default: return c;
    }
  });
}

/**
 * Resolve a layer's runtime value for one variant.
 * Priority: copy_overrides[binding] → bindings.product.<field> → layer.locales[locale] → layer.staticValue
 *
 * Locales only affect the default fallback — i.e. when no dynamic data is
 * supplied, we use the translated layer text if one exists for this variant's
 * locale. Explicit per-row copy overrides still win, which is what you want:
 * if a designer typed "¡Oferta especial!" into the copy override for
 * product.headline, we don't want a stale Spanish template string clobbering it.
 */
function resolveLayerValue(layer: TemplateLayer, bindings: VariantBindings): string {
  if (layer.isDynamic && layer.dataBinding) {
    const overrides = bindings.copy ?? {};
    if (overrides[layer.dataBinding]) return overrides[layer.dataBinding];
    // dataBinding looks like 'product.name', 'product.image_url', 'product.price'
    const parts = layer.dataBinding.split(".");
    if (parts[0] === "product" && bindings.product) {
      const key = parts[1] as keyof typeof bindings.product;
      const v = bindings.product[key];
      if (v != null) return String(v);
    }
  }
  const locale =
    typeof bindings.locale === "string" ? bindings.locale : null;
  if (locale && layer.locales && layer.locales[locale]?.trim()) {
    return layer.locales[locale];
  }
  return layer.staticValue ?? "";
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  if (!url) return null;
  try {
    // Allow relative URLs by anchoring to the public site URL when present.
    const fullUrl = url.startsWith("http")
      ? url
      : new URL(url, process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").toString();
    const res = await fetch(fullUrl);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

/**
 * Build an SVG overlay for a single text layer.
 * The SVG canvas is the layer's own bounding box; sharp will composite it
 * at the layer's top-left corner.
 */
function buildTextSvg(opts: {
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  color: string;
  align: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
}): Buffer {
  const { width, height, text, fontSize, fontWeight, fontFamily, color, align, verticalAlign } = opts;
  const anchor = align === "left" ? "start" : align === "right" ? "end" : "middle";
  const x = align === "left" ? 0 : align === "right" ? width : width / 2;
  // Approximate vertical centering — fontSize * 0.35 baseline offset.
  const baselineY =
    verticalAlign === "top"
      ? fontSize
      : verticalAlign === "bottom"
        ? height
        : height / 2 + fontSize * 0.35;

  // Allow newline support via \n
  const lines = text.split(/\\n|\n/);
  const lineHeight = fontSize * 1.15;
  const startY = baselineY - ((lines.length - 1) * lineHeight) / 2;

  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="${x}" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <text font-family="${escapeXml(fontFamily)}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${color}" text-anchor="${anchor}">${tspans}</text>
</svg>`;
  return Buffer.from(svg);
}

function buildShapeSvg(opts: {
  width: number;
  height: number;
  fill: string;
  radius: number;
  stroke?: string;
  strokeWidth?: number;
}): Buffer {
  const { width, height, fill, radius, stroke, strokeWidth } = opts;
  const strokeAttr = stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth ?? 1}"` : "";
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="${fill}"${strokeAttr}/>
</svg>`;
  return Buffer.from(svg);
}

// ─── Per-variant renderer ────────────────────────────────────────────────────

interface RenderContext {
  template: AssetTemplate;
  brand: BrandTokenSet | null;
}

async function renderOneVariant(variant: Variant, ctx: RenderContext): Promise<Buffer> {
  const { template, brand } = ctx;
  const width = variant.width;
  const height = variant.height;
  const bindings = variant.bindings;

  // Base canvas
  const baseColor = template.backgroundColor || "#FFFFFF";
  let canvas = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: baseColor,
    },
  }).png();

  const composites: sharp.OverlayOptions[] = [];

  const layers = (template.layers ?? []).slice().sort((a, b) => {
    if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex;
    return a.sortOrder - b.sortOrder;
  });

  for (const layer of layers) {
    const layerWidth = Math.max(1, pct(layer.widthPct, width));
    const layerHeight = Math.max(1, pct(layer.heightPct, height));
    const layerLeft = Math.max(0, pct(layer.xPct, width));
    const layerTop = Math.max(0, pct(layer.yPct, height));

    if (layer.layerType === "image" || layer.layerType === "logo") {
      const url = resolveLayerValue(layer, bindings);
      const buf = await fetchImageBuffer(url);
      if (!buf) continue;
      const fit = (layer.props?.fit as "cover" | "contain" | "fill" | undefined) ?? "cover";
      const resized = await sharp(buf)
        .resize(layerWidth, layerHeight, { fit, position: "center" })
        .png()
        .toBuffer();
      composites.push({ input: resized, left: layerLeft, top: layerTop });
      continue;
    }

    if (layer.layerType === "text") {
      const text = resolveLayerValue(layer, bindings);
      if (!text) continue;
      const brandColors = (brand?.tokens?.colors ?? {}) as Record<string, string>;
      const brandFontFamily =
        ((brand?.tokens?.typography?.font_family as string | undefined)) ||
        "Inter, sans-serif";
      const fontSize =
        Number(layer.props?.font_size) || Math.max(12, Math.round(layerHeight * 0.4));
      const fontWeight = Number(layer.props?.font_weight) || 600;
      const color =
        (layer.props?.color as string | undefined) ||
        brandColors.text_primary ||
        "#1F1F1F";
      const align = ((layer.props?.align as string | undefined) ?? "center") as
        | "left"
        | "center"
        | "right";
      const verticalAlign = ((layer.props?.vertical_align as string | undefined) ?? "middle") as
        | "top"
        | "middle"
        | "bottom";
      const svg = buildTextSvg({
        width: layerWidth,
        height: layerHeight,
        text,
        fontSize,
        fontWeight,
        fontFamily: brandFontFamily,
        color,
        align,
        verticalAlign,
      });
      composites.push({ input: svg, left: layerLeft, top: layerTop });
      continue;
    }

    if (layer.layerType === "shape") {
      const fill = (layer.props?.color as string | undefined) || "#69A925";
      const radius = Number(layer.props?.radius) || 0;
      const stroke = layer.props?.stroke as string | undefined;
      const strokeWidth = Number(layer.props?.stroke_width) || undefined;
      const svg = buildShapeSvg({
        width: layerWidth,
        height: layerHeight,
        fill,
        radius,
        stroke,
        strokeWidth,
      });
      composites.push({ input: svg, left: layerLeft, top: layerTop });
      continue;
    }
  }

  if (composites.length > 0) {
    canvas = canvas.composite(composites);
  }

  const format = variant.outputSpec?.format ?? "png";
  if (format === "jpg") return await canvas.jpeg({ quality: 90 }).toBuffer();
  if (format === "webp") return await canvas.webp({ quality: 92 }).toBuffer();
  return await canvas.png().toBuffer();
}

function contentTypeFor(format: "png" | "jpg" | "webp"): string {
  if (format === "jpg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return "image/png";
}

function toTemplateLayer(row: Record<string, unknown>): TemplateLayer {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    name: (row.name as string) ?? "",
    layerType: row.layer_type as TemplateLayer["layerType"],
    isDynamic: Boolean(row.is_dynamic),
    isLocked: Boolean(row.is_locked),
    dataBinding: (row.data_binding as string) ?? "",
    staticValue: (row.static_value as string) ?? "",
    xPct: Number(row.x_pct ?? 0),
    yPct: Number(row.y_pct ?? 0),
    widthPct: Number(row.width_pct ?? 100),
    heightPct: Number(row.height_pct ?? 100),
    rotationDeg: Number(row.rotation_deg ?? 0),
    zIndex: Number(row.z_index ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
    props: (row.props as TemplateLayer["props"]) ?? {},
    locales: (row.locales as Record<string, string>) ?? {},
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

function toTemplateOutputSpec(row: Record<string, unknown>): TemplateOutputSpec {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    label: (row.label as string) ?? "",
    width: Number(row.width ?? 0),
    height: Number(row.height ?? 0),
    channel: (row.channel as string) ?? "",
    format: ((row.format as TemplateOutputSpec["format"] | undefined) ?? "png"),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

function toRenderVariant(row: Record<string, unknown>): Variant {
  const spec = row.template_output_specs as Record<string, unknown> | null | undefined;
  return {
    id: row.id as string,
    runId: row.run_id as string,
    templateId: (row.template_id as string | null) ?? null,
    outputSpecId: (row.output_spec_id as string | null) ?? null,
    campaignProductId: null,
    width: Number(row.width),
    height: Number(row.height),
    status: row.status as Variant["status"],
    assetUrl: null,
    storagePath: null,
    thumbnailUrl: null,
    localeCode: null,
    bindings: (row.bindings as VariantBindings) ?? {},
    errorMessage: null,
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    outputSpec: spec ? toTemplateOutputSpec(spec) : null,
  };
}

async function getRunForRender(runId: string): Promise<{
  id: string;
  templateId: string | null;
  variants: Variant[];
} | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("variant_runs")
    .select(
      "id, template_id, variants(id, run_id, template_id, output_spec_id, width, height, status, bindings, template_output_specs(id, template_id, label, width, height, channel, format, sort_order, created_at))"
    )
    .eq("id", runId)
    .maybeSingle();
  if (error || !data) return null;

  const variants = ((data.variants as Record<string, unknown>[] | null) ?? []).map(
    toRenderVariant
  );
  return {
    id: data.id as string,
    templateId: (data.template_id as string | null) ?? null,
    variants,
  };
}

async function getTemplateForRender(templateId: string): Promise<AssetTemplate | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("templates")
    .select(
      "id, name, description, status, category, brand_tokens_id, thumbnail_url, canvas_width, canvas_height, background_color, current_version_id, created_by, created_at, updated_at, template_layers(*)"
    )
    .eq("id", templateId)
    .maybeSingle();
  if (error || !data) return null;

  const layers = ((data.template_layers as Record<string, unknown>[] | null) ?? [])
    .map(toTemplateLayer)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    id: data.id as string,
    name: (data.name as string) ?? "",
    description: (data.description as string) ?? "",
    status: data.status as AssetTemplate["status"],
    category: (data.category as string) ?? "general",
    brandTokensId: (data.brand_tokens_id as string | null) ?? null,
    thumbnailUrl: (data.thumbnail_url as string | null) ?? null,
    canvasWidth: Number(data.canvas_width ?? 1080),
    canvasHeight: Number(data.canvas_height ?? 1080),
    backgroundColor: (data.background_color as string) ?? "#FFFFFF",
    currentVersionId: (data.current_version_id as string | null) ?? null,
    createdBy: (data.created_by as string | null) ?? null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    layers,
    outputSpecs: [],
    versions: [],
    brandTokens: null,
  };
}

async function getBrandForRender(template: AssetTemplate): Promise<BrandTokenSet | null> {
  const admin = createAdminClient();

  if (template.brandTokensId) {
    const { data } = await admin
      .from("brand_tokens")
      .select("*")
      .eq("id", template.brandTokensId)
      .maybeSingle();
    if (data) {
      return {
        id: data.id as string,
        brand: data.brand as string,
        version: Number(data.version),
        isActive: Boolean(data.is_active),
        notes: (data.notes as string) ?? "",
        tokens: (data.tokens as BrandTokenSet["tokens"]) ?? {},
        createdBy: (data.created_by as string | null) ?? null,
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
      };
    }
  }

  const { data: active } = await admin
    .from("brand_tokens")
    .select("*")
    .eq("brand", "Publix")
    .eq("is_active", true)
    .maybeSingle();
  if (!active) return null;
  return {
    id: active.id as string,
    brand: active.brand as string,
    version: Number(active.version),
    isActive: Boolean(active.is_active),
    notes: (active.notes as string) ?? "",
    tokens: (active.tokens as BrandTokenSet["tokens"]) ?? {},
    createdBy: (active.created_by as string | null) ?? null,
    createdAt: active.created_at as string,
    updatedAt: active.updated_at as string,
  };
}

async function emitVariantStatus(
  cb: RenderRunOptions["onVariantStatus"],
  event: RenderRunVariantEvent
): Promise<void> {
  if (!cb) return;
  try {
    await cb(event);
  } catch (error) {
    console.error("[renderRun] variant status callback failed", error);
  }
}

// ─── Run-level orchestrator ──────────────────────────────────────────────────

/**
 * Render every pending variant in a run. Uploads each result to the
 * `variants` bucket and updates the variants row with asset_url + status.
 *
 * This is intentionally synchronous (loops sequentially) for Sprint 1 — fine
 * for the 30-variant demo. A real implementation would queue this via a job
 * runner with concurrency limits.
 */
export async function renderRun(
  runId: string,
  opts?: RenderRunOptions
): Promise<RenderRunResult> {
  const admin = createAdminClient();

  const run = await getRunForRender(runId);
  if (!run) throw new Error(`renderRun: run ${runId} not found`);
  if (!run.templateId) throw new Error(`renderRun: run ${runId} has no template`);

  const template = await getTemplateForRender(run.templateId);
  if (!template) throw new Error(`renderRun: template ${run.templateId} not found`);
  const brandResolved = await getBrandForRender(template);

  // Mark run as rendering
  await admin
    .from("variant_runs")
    .update({ status: "rendering", started_at: new Date().toISOString() })
    .eq("id", runId);

  const requestedIds = opts?.variantIds?.length ? new Set(opts.variantIds) : null;
  const selectedVariants = requestedIds
    ? (run.variants ?? []).filter((v) => requestedIds.has(v.id))
    : (run.variants ?? []);
  const variants = selectedVariants.filter((v) => v.status === "pending");
  const skippedVariants = selectedVariants.filter((v) => v.status !== "pending");

  for (const skippedVariant of skippedVariants) {
    await emitVariantStatus(opts?.onVariantStatus, {
      variantId: skippedVariant.id,
      status: "skipped",
    });
  }

  let rendered = 0;
  let failed = 0;
  const skipped = skippedVariants.length;

  for (const variant of variants) {
    try {
      // Claim this variant only if it's still pending. If another action (cancel,
      // manual status update) already moved it out of pending, skip it.
      const { data: claimed } = await admin
        .from("variants")
        .update({ status: "rendering" })
        .eq("id", variant.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (!claimed) {
        await emitVariantStatus(opts?.onVariantStatus, {
          variantId: variant.id,
          status: "skipped",
        });
        continue;
      }
      await emitVariantStatus(opts?.onVariantStatus, {
        variantId: variant.id,
        status: "rendering",
      });

      const buffer = await renderOneVariant(variant, { template, brand: brandResolved });

      const format = variant.outputSpec?.format ?? "png";
      const ext = format === "jpg" ? "jpg" : format;
      const path = `${runId}/${variant.id}.${ext}`;
      const { error: uploadErr } = await admin.storage
        .from("variants")
        .upload(path, buffer, {
          contentType: contentTypeFor(format),
          upsert: true,
          cacheControl: "31536000",
        });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = admin.storage.from("variants").getPublicUrl(path);

      const { data: persisted } = await admin
        .from("variants")
        .update({
          status: "rendered",
          asset_url: urlData.publicUrl,
          storage_path: path,
          thumbnail_url: urlData.publicUrl,
          error_message: null,
        })
        .eq("status", "rendering")
        .eq("id", variant.id)
        .select("id");
      if (persisted && persisted.length > 0) {
        rendered += 1;
        await emitVariantStatus(opts?.onVariantStatus, {
          variantId: variant.id,
          status: "rendered",
        });
      } else {
        await emitVariantStatus(opts?.onVariantStatus, {
          variantId: variant.id,
          status: "skipped",
        });
      }
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      await admin
        .from("variants")
        .update({ status: "failed", error_message: message })
        .eq("status", "rendering")
        .eq("id", variant.id);
      await emitVariantStatus(opts?.onVariantStatus, {
        variantId: variant.id,
        status: "failed",
        errorMessage: message,
      });
    }
  }

  // Recompute counts + flip terminal status
  const { data: allVariants } = await admin
    .from("variants")
    .select("status")
    .eq("run_id", runId);
  const total = allVariants?.length ?? 0;
  let completedCount = 0;
  let failedCount = 0;
  for (const v of allVariants ?? []) {
    const s = (v as { status: string }).status;
    if (s === "rendered" || s === "approved" || s === "rejected") completedCount += 1;
    if (s === "failed") failedCount += 1;
  }
  const terminal = completedCount + failedCount === total && total > 0;
  const { data: runStatusRow } = await admin
    .from("variant_runs")
    .select("status")
    .eq("id", runId)
    .maybeSingle();
  const runWasCancelled = runStatusRow?.status === "cancelled";

  await admin
    .from("variant_runs")
    .update({
      total_variants: total,
      completed_variants: completedCount,
      failed_variants: failedCount,
      ...(runWasCancelled
        ? {}
        : {
            status: terminal
              ? failedCount === total
                ? "failed"
                : "completed"
              : "rendering",
            completed_at: terminal ? new Date().toISOString() : null,
          }),
    })
    .eq("id", runId);

  return { runId, rendered, failed, skipped };
}

// ─── On-demand preview (editor) ──────────────────────────────────────────────

/**
 * Render a single variant for the template editor's "Live preview" button.
 * Doesn't persist anything — returns the image bytes + content type so the
 * editor can show them in a modal. If no campaign_product_id is supplied
 * we pick the first one we can find for rough visual truth; if none exists
 * we synthesize a stub product so the designer can still see the layout.
 */
export async function renderTemplatePreview(input: {
  templateId: string;
  specId?: string;
  campaignProductId?: string;
  copyOverrides?: Record<string, string>;
  localeCode?: string;
}): Promise<{ buffer: Buffer; contentType: string }> {
  const admin = createAdminClient();

  const template = await getTemplate(input.templateId);
  if (!template) throw new Error(`Template ${input.templateId} not found`);

  // Pick the target spec: requested spec, or first by sort order, or a
  // default 1080² if the template has none.
  const specs = template.outputSpecs ?? [];
  const spec =
    (input.specId ? specs.find((s) => s.id === input.specId) : undefined) ??
    specs[0] ??
    null;
  const width = spec?.width ?? template.canvasWidth ?? 1080;
  const height = spec?.height ?? template.canvasHeight ?? 1080;
  const format = spec?.format ?? "png";

  // Pick a product for live binding values.
  let product: {
    id?: string;
    name: string;
    image_url: string;
    department?: string;
    item_code?: string | null;
  } = {
    name: "Preview Product",
    image_url: "",
    department: "",
    item_code: null,
  };
  let cpId: string | undefined = input.campaignProductId;
  if (cpId) {
    const { data } = await admin
      .from("campaign_products")
      .select("*, products(*)")
      .eq("id", cpId)
      .maybeSingle();
    if (data?.products) {
      const p = data.products as Record<string, unknown>;
      product = {
        id: p.id as string | undefined,
        name: (p.name as string) ?? "",
        image_url: (p.image_url as string) ?? "",
        department: (p.department as string) ?? "",
        item_code: (p.item_code as string | null) ?? null,
      };
    }
  } else {
    // Fall back to any linked campaign product.
    const { data } = await admin
      .from("campaign_products")
      .select("id, products(*)")
      .limit(1);
    if (data?.[0]?.products) {
      cpId = data[0].id as string;
      const p = data[0].products as unknown as Record<string, unknown>;
      product = {
        id: p.id as string | undefined,
        name: (p.name as string) ?? "",
        image_url: (p.image_url as string) ?? "",
        department: (p.department as string) ?? "",
        item_code: (p.item_code as string | null) ?? null,
      };
    }
  }

  const brand = template.brandTokensId
    ? await (async () => {
        const { data } = await admin
          .from("brand_tokens")
          .select("*")
          .eq("id", template.brandTokensId)
          .maybeSingle();
        if (!data) return await getActiveBrandTokens();
        return {
          id: data.id,
          brand: data.brand,
          version: data.version,
          isActive: Boolean(data.is_active),
          notes: data.notes ?? "",
          tokens: data.tokens ?? {},
          createdBy: data.created_by ?? null,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      })()
    : await getActiveBrandTokens();

  // Synthesize an in-memory Variant so we can reuse renderOneVariant.
  const transientVariant: Variant = {
    id: "preview",
    runId: "preview",
    templateId: template.id,
    outputSpecId: spec?.id ?? null,
    campaignProductId: cpId ?? null,
    width,
    height,
    status: "pending",
    assetUrl: null,
    storagePath: null,
    thumbnailUrl: null,
    localeCode: input.localeCode ?? null,
    bindings: {
      product,
      copy: input.copyOverrides ?? {},
      ...(input.localeCode ? { locale: input.localeCode } : {}),
    },
    errorMessage: null,
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    outputSpec: spec ?? null,
  };

  const buffer = await renderOneVariant(transientVariant, { template, brand });
  return { buffer, contentType: contentTypeFor(format) };
}
