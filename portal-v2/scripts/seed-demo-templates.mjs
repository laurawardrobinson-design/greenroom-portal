// Seeds a handful of sample Asset Studio templates so the demo has more than
// one row in the template picker. Safe to re-run — idempotent by template name.
//
// Creates, for each sample:
//   - templates row (status=published)
//   - template_layers rows (the layout)
//   - template_output_specs rows (POP + digital sizes)
//   - template_versions row with the full snapshot (mirrors publish flow)
//   - templates.current_version_id set
//   - a sharp-rendered thumbnail uploaded to the `templates` bucket
//
// Run with:
//   node --env-file=portal-v2/.env.local portal-v2/scripts/seed-demo-templates.mjs

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { randomUUID } from "crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

// ─── Sample templates ────────────────────────────────────────────────────────

// Each template ships with a focused layout + the POP/digital sizes that
// actually make sense for its primary use case. Designers can add more sizes
// from the editor afterward via the "+ POP & digital pack" action.

const TEMPLATES = [
  {
    name: "Publix Bakery Bin Card",
    description:
      "5.5×3.5 in bin-card layout for deli / bakery cases. Product image left, name + price right.",
    category: "bin-card",
    canvasWidth: 550,
    canvasHeight: 350,
    backgroundColor: "#ffffff",
    layers: [
      // Green accent bar on the left
      {
        name: "Accent bar",
        layerType: "shape",
        isDynamic: false,
        staticValue: "#007A3D",
        xPct: 0,
        yPct: 0,
        widthPct: 6,
        heightPct: 100,
        zIndex: 0,
        sortOrder: 10,
        props: { fit: "fill" },
      },
      // Product image — pulls product.image_url dynamically
      {
        name: "Product image",
        layerType: "image",
        isDynamic: true,
        dataBinding: "product.image_url",
        xPct: 10,
        yPct: 15,
        widthPct: 35,
        heightPct: 70,
        zIndex: 10,
        sortOrder: 20,
        props: { fit: "contain" },
      },
      // Headline / product name
      {
        name: "Product name",
        layerType: "text",
        isDynamic: true,
        dataBinding: "product.name",
        staticValue: "Product Name",
        xPct: 48,
        yPct: 22,
        widthPct: 48,
        heightPct: 40,
        zIndex: 20,
        sortOrder: 30,
        props: { fontSize: 26, fontWeight: "700", color: "#1a1a1a", align: "left" },
      },
      // Price badge
      {
        name: "Price",
        layerType: "text",
        isDynamic: false,
        staticValue: "$3.99",
        xPct: 48,
        yPct: 62,
        widthPct: 48,
        heightPct: 28,
        zIndex: 30,
        sortOrder: 40,
        props: { fontSize: 38, fontWeight: "700", color: "#007A3D", align: "left" },
      },
      // Logo bottom-right corner
      {
        name: "Greenroom logo",
        layerType: "logo",
        isDynamic: false,
        staticValue: "/greenroom-logo.png",
        xPct: 80,
        yPct: 82,
        widthPct: 16,
        heightPct: 12,
        zIndex: 40,
        sortOrder: 50,
        props: { fit: "contain" },
      },
    ],
    outputSpecs: [
      { label: "Bin Card", width: 550, height: 350, channel: "in-store", format: "png", sortOrder: 10 },
      { label: "Shelf Strip", width: 1100, height: 250, channel: "in-store", format: "png", sortOrder: 20 },
      { label: "Counter Card", width: 500, height: 700, channel: "in-store", format: "png", sortOrder: 30 },
    ],
  },

  {
    name: "Publix End-Cap Header",
    description:
      "36×12 in end-cap crown. Wide horizontal format with a single hero product and deal callout.",
    category: "endcap-header",
    canvasWidth: 3600,
    canvasHeight: 1200,
    backgroundColor: "#007A3D",
    layers: [
      // White panel on the right for product
      {
        name: "Product panel",
        layerType: "shape",
        isDynamic: false,
        staticValue: "#ffffff",
        xPct: 65,
        yPct: 10,
        widthPct: 30,
        heightPct: 80,
        zIndex: 10,
        sortOrder: 10,
        props: { fit: "fill" },
      },
      // Product image inside the white panel
      {
        name: "Product image",
        layerType: "image",
        isDynamic: true,
        dataBinding: "product.image_url",
        xPct: 67,
        yPct: 15,
        widthPct: 26,
        heightPct: 70,
        zIndex: 20,
        sortOrder: 20,
        props: { fit: "contain" },
      },
      // Bold headline left
      {
        name: "Hero headline",
        layerType: "text",
        isDynamic: false,
        staticValue: "WEEKLY SAVINGS",
        xPct: 5,
        yPct: 20,
        widthPct: 55,
        heightPct: 25,
        zIndex: 30,
        sortOrder: 30,
        props: { fontSize: 140, fontWeight: "800", color: "#ffffff", align: "left" },
      },
      // Product name below headline
      {
        name: "Product name",
        layerType: "text",
        isDynamic: true,
        dataBinding: "product.name",
        staticValue: "Product",
        xPct: 5,
        yPct: 48,
        widthPct: 55,
        heightPct: 20,
        zIndex: 40,
        sortOrder: 40,
        props: { fontSize: 80, fontWeight: "600", color: "#ffffff", align: "left" },
      },
      // Price
      {
        name: "Price",
        layerType: "text",
        isDynamic: false,
        staticValue: "2 / $5",
        xPct: 5,
        yPct: 68,
        widthPct: 30,
        heightPct: 22,
        zIndex: 50,
        sortOrder: 50,
        props: { fontSize: 120, fontWeight: "800", color: "#FFD100", align: "left" },
      },
      // Logo small in corner
      {
        name: "Greenroom logo",
        layerType: "logo",
        isDynamic: false,
        staticValue: "/greenroom-logo.png",
        xPct: 88,
        yPct: 82,
        widthPct: 10,
        heightPct: 12,
        zIndex: 60,
        sortOrder: 60,
        props: { fit: "contain" },
      },
    ],
    outputSpecs: [
      { label: "End-Cap Header", width: 3600, height: 1200, channel: "in-store", format: "jpg", sortOrder: 10 },
      { label: "Aisle Violator", width: 1400, height: 2200, channel: "in-store", format: "png", sortOrder: 20 },
      { label: "Tabloid Poster", width: 1100, height: 1700, channel: "print", format: "jpg", sortOrder: 30 },
    ],
  },

  {
    name: "Publix Social Deal Square",
    description:
      "1080×1080 Instagram/Facebook feed template. Logo top, product center, price badge bottom.",
    category: "social-square",
    canvasWidth: 1080,
    canvasHeight: 1080,
    backgroundColor: "#F4F0E6",
    layers: [
      // Logo header
      {
        name: "Greenroom logo",
        layerType: "logo",
        isDynamic: false,
        staticValue: "/greenroom-logo.png",
        xPct: 38,
        yPct: 6,
        widthPct: 24,
        heightPct: 8,
        zIndex: 10,
        sortOrder: 10,
        props: { fit: "contain" },
      },
      // "FRESH THIS WEEK" overline
      {
        name: "Overline",
        layerType: "text",
        isDynamic: false,
        staticValue: "FRESH THIS WEEK",
        xPct: 10,
        yPct: 18,
        widthPct: 80,
        heightPct: 6,
        zIndex: 20,
        sortOrder: 20,
        props: { fontSize: 32, fontWeight: "700", color: "#007A3D", align: "center" },
      },
      // Hero product image
      {
        name: "Product image",
        layerType: "image",
        isDynamic: true,
        dataBinding: "product.image_url",
        xPct: 15,
        yPct: 28,
        widthPct: 70,
        heightPct: 45,
        zIndex: 30,
        sortOrder: 30,
        props: { fit: "contain" },
      },
      // Product name
      {
        name: "Product name",
        layerType: "text",
        isDynamic: true,
        dataBinding: "product.name",
        staticValue: "Product Name",
        xPct: 8,
        yPct: 74,
        widthPct: 84,
        heightPct: 10,
        zIndex: 40,
        sortOrder: 40,
        props: { fontSize: 52, fontWeight: "700", color: "#1a1a1a", align: "center" },
      },
      // Price badge
      {
        name: "Price",
        layerType: "text",
        isDynamic: false,
        staticValue: "$4.99",
        xPct: 35,
        yPct: 86,
        widthPct: 30,
        heightPct: 10,
        zIndex: 50,
        sortOrder: 50,
        props: { fontSize: 72, fontWeight: "800", color: "#007A3D", align: "center" },
      },
    ],
    outputSpecs: [
      { label: "Instagram Feed (1:1)", width: 1080, height: 1080, channel: "digital", format: "jpg", sortOrder: 10 },
      { label: "Instagram Feed (4:5)", width: 1080, height: 1350, channel: "digital", format: "jpg", sortOrder: 20 },
      { label: "Story / Reel / TikTok", width: 1080, height: 1920, channel: "digital", format: "jpg", sortOrder: 30 },
      { label: "Facebook Link (1.91:1)", width: 1200, height: 628, channel: "digital", format: "jpg", sortOrder: 40 },
      { label: "Email Hero Banner", width: 1200, height: 600, channel: "digital", format: "jpg", sortOrder: 50 },
    ],
  },
];

// ─── Thumbnail generation (sharp) ────────────────────────────────────────────

/**
 * Render a simple thumbnail for the template picker: background color with
 * the template name in white, badged with its canvas dimensions. 480×480
 * keeps the storage footprint small while still readable.
 */
async function renderThumbnail(tmpl) {
  const W = 480;
  const H = 480;
  const aspectRatio = tmpl.canvasWidth / tmpl.canvasHeight;
  // Compute a centered inner rectangle that matches the template aspect ratio,
  // so the thumb communicates shape at a glance.
  const inner =
    aspectRatio > 1
      ? { w: Math.round(W * 0.8), h: Math.round((W * 0.8) / aspectRatio) }
      : { w: Math.round(H * 0.8 * aspectRatio), h: Math.round(H * 0.8) };
  const innerX = Math.round((W - inner.w) / 2);
  const innerY = Math.round((H - inner.h) / 2);

  const titleSvg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#1a1a1a"/>
      <rect x="${innerX}" y="${innerY}" width="${inner.w}" height="${inner.h}"
            fill="${tmpl.backgroundColor}" stroke="#333" stroke-width="2"/>
      <text x="${W / 2}" y="${H / 2 - 10}" font-family="Inter, Arial, sans-serif"
            font-size="26" font-weight="700" fill="#ffffff" text-anchor="middle">${escapeXml(tmpl.name)}</text>
      <text x="${W / 2}" y="${H / 2 + 20}" font-family="Inter, Arial, sans-serif"
            font-size="16" font-weight="500" fill="#9ca3af" text-anchor="middle">${tmpl.canvasWidth}×${tmpl.canvasHeight}</text>
    </svg>`;

  return sharp(Buffer.from(titleSvg)).jpeg({ quality: 82 }).toBuffer();
}

function escapeXml(s) {
  return String(s ?? "").replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      default:
        return c;
    }
  });
}

// ─── Seeder ──────────────────────────────────────────────────────────────────

async function seedTemplate(tmpl) {
  // Idempotency: look up by exact name first. If the template already exists
  // we skip creation but still refresh the thumbnail (cheap; ensures re-runs
  // keep the preview fresh after edits to this script).
  const { data: existing } = await admin
    .from("templates")
    .select("id, thumbnail_url")
    .eq("name", tmpl.name)
    .maybeSingle();

  let templateId = existing?.id;
  let createdNew = false;

  if (!templateId) {
    const { data, error } = await admin
      .from("templates")
      .insert({
        name: tmpl.name,
        description: tmpl.description,
        status: "draft",
        category: tmpl.category,
        canvas_width: tmpl.canvasWidth,
        canvas_height: tmpl.canvasHeight,
        background_color: tmpl.backgroundColor,
      })
      .select("id")
      .single();
    if (error) throw error;
    templateId = data.id;
    createdNew = true;

    // Insert layers
    const { error: lerr } = await admin.from("template_layers").insert(
      tmpl.layers.map((l) => ({
        template_id: templateId,
        name: l.name,
        layer_type: l.layerType,
        is_dynamic: l.isDynamic ?? false,
        is_locked: l.isLocked ?? false,
        data_binding: l.dataBinding ?? "",
        static_value: l.staticValue ?? "",
        x_pct: l.xPct ?? 0,
        y_pct: l.yPct ?? 0,
        width_pct: l.widthPct ?? 100,
        height_pct: l.heightPct ?? 100,
        rotation_deg: l.rotationDeg ?? 0,
        z_index: l.zIndex ?? 0,
        sort_order: l.sortOrder ?? 0,
        props: l.props ?? {},
      }))
    );
    if (lerr) throw lerr;

    // Insert output specs
    const { error: serr } = await admin.from("template_output_specs").insert(
      tmpl.outputSpecs.map((s) => ({
        template_id: templateId,
        label: s.label,
        width: s.width,
        height: s.height,
        channel: s.channel ?? "",
        format: s.format ?? "png",
        sort_order: s.sortOrder ?? 0,
      }))
    );
    if (serr) throw serr;

    // Read back the inserted rows so we can snapshot with real ids/timestamps.
    const [{ data: layersBack }, { data: specsBack }, { data: tmplBack }] = await Promise.all([
      admin.from("template_layers").select("*").eq("template_id", templateId),
      admin.from("template_output_specs").select("*").eq("template_id", templateId),
      admin.from("templates").select("*").eq("id", templateId).single(),
    ]);

    // Publish: create a template_versions row + flip status + set current_version_id.
    const snapshot = {
      template: tmplBack,
      layers: layersBack ?? [],
      outputSpecs: specsBack ?? [],
    };
    const versionId = randomUUID();
    const { error: verr } = await admin.from("template_versions").insert({
      id: versionId,
      template_id: templateId,
      version: 1,
      notes: "Initial seed",
      snapshot,
    });
    if (verr) throw verr;
    await admin
      .from("templates")
      .update({ status: "published", current_version_id: versionId })
      .eq("id", templateId);
  }

  // Always regenerate + upload the thumbnail (cheap, keeps visuals fresh after
  // layout tweaks to the seeder script itself).
  const thumb = await renderThumbnail(tmpl);
  const thumbPath = `seed/${templateId}.jpg`;
  const up = await admin.storage
    .from("templates")
    .upload(thumbPath, thumb, {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (up.error) {
    console.warn(`  ! thumbnail upload failed for ${tmpl.name}:`, up.error.message);
  } else {
    const {
      data: { publicUrl },
    } = admin.storage.from("templates").getPublicUrl(thumbPath);
    await admin.from("templates").update({ thumbnail_url: publicUrl }).eq("id", templateId);
  }

  return { templateId, createdNew };
}

console.log(`Seeding ${TEMPLATES.length} demo templates…`);

for (const tmpl of TEMPLATES) {
  try {
    const { templateId, createdNew } = await seedTemplate(tmpl);
    console.log(`  ${createdNew ? "+" : "="} ${tmpl.name} (${templateId})`);
  } catch (err) {
    console.error(`  ! ${tmpl.name} failed:`, err.message);
  }
}

console.log("Done.");
