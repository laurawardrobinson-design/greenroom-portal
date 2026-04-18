import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRun } from "./runs.service";
import { getTemplate } from "./templates.service";
import { getActiveBrandTokens } from "./brand.service";
import type {
  AssetTemplate,
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
 * Priority: copy_overrides[binding] → variant.bindings.product.<field> → layer.staticValue
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

// ─── Run-level orchestrator ──────────────────────────────────────────────────

/**
 * Render every pending variant in a run. Uploads each result to the
 * `variants` bucket and updates the variants row with asset_url + status.
 *
 * This is intentionally synchronous (loops sequentially) for Sprint 1 — fine
 * for the 30-variant demo. A real implementation would queue this via a job
 * runner with concurrency limits.
 */
export async function renderRun(runId: string): Promise<RenderRunResult> {
  const admin = createAdminClient();

  const run = await getRun(runId);
  if (!run) throw new Error(`renderRun: run ${runId} not found`);
  if (!run.templateId) throw new Error(`renderRun: run ${runId} has no template`);

  const template = await getTemplate(run.templateId);
  if (!template) throw new Error(`renderRun: template ${run.templateId} not found`);
  const brand = template.brandTokensId
    ? null // placeholder for explicit lookup — falls back to active brand below
    : await getActiveBrandTokens();
  // If template has a pinned brand version, prefer it. Otherwise use active.
  let brandResolved: BrandTokenSet | null = brand;
  if (template.brandTokensId) {
    const { data } = await admin
      .from("brand_tokens")
      .select("*")
      .eq("id", template.brandTokensId)
      .maybeSingle();
    if (data) {
      brandResolved = {
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
    } else {
      brandResolved = await getActiveBrandTokens();
    }
  }

  // Mark run as rendering
  await admin
    .from("variant_runs")
    .update({ status: "rendering", started_at: new Date().toISOString() })
    .eq("id", runId);

  const variants = (run.variants ?? []).filter((v) => v.status === "pending");
  let rendered = 0;
  let failed = 0;
  const skipped = (run.variants ?? []).length - variants.length;

  for (const variant of variants) {
    try {
      // Mark this one as rendering
      await admin.from("variants").update({ status: "rendering" }).eq("id", variant.id);

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

      await admin
        .from("variants")
        .update({
          status: "rendered",
          asset_url: urlData.publicUrl,
          storage_path: path,
          thumbnail_url: urlData.publicUrl,
          error_message: null,
        })
        .eq("id", variant.id);
      rendered += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      await admin
        .from("variants")
        .update({ status: "failed", error_message: message })
        .eq("id", variant.id);
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

  await admin
    .from("variant_runs")
    .update({
      total_variants: total,
      completed_variants: completedCount,
      failed_variants: failedCount,
      status: terminal
        ? failedCount === total
          ? "failed"
          : "completed"
        : "rendering",
      completed_at: terminal ? new Date().toISOString() : null,
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
    bindings: {
      product,
      copy: input.copyOverrides ?? {},
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
