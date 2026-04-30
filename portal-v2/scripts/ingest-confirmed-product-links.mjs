// Ingest reviewed product links: reads scripts/.review/product-links.md,
// pulls every row with a Confirmed URL filled in, fetches each publix.com
// page, and updates the matching product with:
//
//   - pcom_link        ← the confirmed URL
//   - item_code        ← extracted from the URL (RIO-XXX-NNNNNN)
//   - image_url        ← mirrored into Supabase Storage from the publix CDN
//   - source_image_url ← the original publix CDN URL (preserved for re-mirror)
//
// What this script does NOT do:
//   - Set description (humans enter that, never the script).
//   - Guess an item code or URL. If a row's Confirmed URL doesn't parse
//     into a valid Publix PDP, the row is skipped and reported.
//
// Run with:
//   node --env-file=portal-v2/.env.local portal-v2/scripts/ingest-confirmed-product-links.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const REVIEW_FILE = "portal-v2/scripts/.review/product-links.md";
const BUCKET = "brand-assets";
const PREFIX = "products";

function extractItemCode(url) {
  const m = url.match(/RIO-[A-Z]+-(\d+)/i);
  return m?.[1] ? m[1].replace(/^0+(\d)/, "$1") : null;
}

function buildPublixImageUrl(itemCode) {
  const num = parseInt(itemCode, 10);
  if (Number.isNaN(num)) return null;
  const folder = Math.floor(num / 5000) * 5000;
  const padded = itemCode.padStart(6, "0");
  return `https://images.publixcdn.com/pct/images/products/${folder}/${padded}-600x600-A.jpg`;
}

function slugify(input, fallback) {
  const s = String(input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || fallback;
}

function extFromContentType(ct) {
  if (!ct) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  return "jpg";
}

// --- Parse review file ---

const md = readFileSync(REVIEW_FILE, "utf8");
const rowRe = /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*[^|]*\|\s*[^|]*\|\s*[^|]*\|\s*[^|]*\|\s*([^|]*?)\s*\|\s*$/gm;
const tasks = [];
let m;
while ((m = rowRe.exec(md)) !== null) {
  const [, rowNum, name, confirmedRaw] = m;
  const confirmed = confirmedRaw.trim();
  if (!confirmed) continue;
  // Tolerate markdown link syntax: [label](url) or bare URL
  const linkMatch = confirmed.match(/\((https?:\/\/[^)]+)\)/);
  const finalUrl = linkMatch ? linkMatch[1] : confirmed;
  if (!/^https?:\/\//.test(finalUrl)) {
    console.warn(`row ${rowNum} (${name}): not a URL, skipping`);
    continue;
  }
  if (!finalUrl.includes("publix.com")) {
    console.warn(`row ${rowNum} (${name}): non-publix URL, skipping`);
    continue;
  }
  tasks.push({ rowNum, name: name.trim(), url: finalUrl });
}

console.log(`Parsed ${tasks.length} confirmed rows.`);

if (tasks.length === 0) {
  console.log("Nothing to ingest. Fill in the Confirmed URL column first.");
  process.exit(0);
}

let updated = 0;
const failures = [];

for (const t of tasks) {
  const itemCode = extractItemCode(t.url);
  if (!itemCode) {
    failures.push({ name: t.name, err: "could not extract item code from URL" });
    continue;
  }

  // Find the product row by name (case-insensitive exact match).
  const { data: matches, error: mErr } = await admin
    .from("products")
    .select("id, name")
    .ilike("name", t.name);
  if (mErr) {
    failures.push({ name: t.name, err: mErr.message });
    continue;
  }
  if (!matches || matches.length === 0) {
    failures.push({ name: t.name, err: "no product row matched name" });
    continue;
  }
  if (matches.length > 1) {
    failures.push({ name: t.name, err: `${matches.length} products match name — ambiguous` });
    continue;
  }
  const productId = matches[0].id;

  // Mirror image from publix CDN.
  const sourceImage = buildPublixImageUrl(itemCode);
  let mirroredUrl = null;
  if (sourceImage) {
    try {
      const res = await fetch(sourceImage, { redirect: "follow" });
      if (!res.ok) {
        failures.push({ name: t.name, err: `image fetch ${res.status}` });
      } else {
        const ct = res.headers.get("content-type") || "image/jpeg";
        const ext = extFromContentType(ct);
        const buf = Buffer.from(await res.arrayBuffer());
        const path = `${PREFIX}/${slugify(itemCode, productId.slice(0, 8))}.${ext}`;
        const { error: upErr } = await admin.storage
          .from(BUCKET)
          .upload(path, buf, { contentType: ct, upsert: true, cacheControl: "31536000" });
        if (upErr) {
          failures.push({ name: t.name, err: `storage upload: ${upErr.message}` });
        } else {
          mirroredUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        }
      }
    } catch (e) {
      failures.push({ name: t.name, err: `image: ${String(e).slice(0, 100)}` });
    }
  }

  const update = {
    pcom_link: t.url,
    pcom_link_broken_at: null,
    item_code: itemCode,
  };
  if (mirroredUrl) {
    update.image_url = mirroredUrl;
    update.source_image_url = sourceImage;
  }

  const { error: updErr } = await admin
    .from("products")
    .update(update)
    .eq("id", productId);
  if (updErr) {
    failures.push({ name: t.name, err: `db update: ${updErr.message}` });
    continue;
  }
  updated += 1;
  process.stdout.write(`  ✓ ${t.name} (item ${itemCode})\n`);
}

console.log(`\nDone. updated=${updated} failures=${failures.length}`);
if (failures.length > 0) {
  console.log("Failures:");
  for (const f of failures) console.log(` - ${f.name}: ${f.err}`);
  process.exit(1);
}
