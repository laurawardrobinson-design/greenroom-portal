// Backfill: mirror every product's image into Supabase Storage and rewrite
// products.image_url to point at our own bucket. Safe to re-run — upsert:true
// and only mirrors rows whose image_url is still external.
//
// Run with:
//   node --env-file=.env.local portal-v2/scripts/mirror-product-images.mjs

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY (legacy: SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const BUCKET = "brand-assets";
const PREFIX = "products";
const NATIVE_HOSTS = [".supabase.co", ".supabase.in"];

function isNative(u) {
  try {
    return NATIVE_HOSTS.some((h) => new URL(u).hostname.endsWith(h));
  } catch {
    return false;
  }
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
  if (ct.includes("svg")) return "svg";
  return "jpg";
}

const { data: products, error: pErr } = await admin
  .from("products")
  .select("id, name, image_url, source_image_url, item_code")
  .not("image_url", "is", null);
if (pErr) {
  console.error("Failed to read products:", pErr);
  process.exit(1);
}

const targets = products.filter((p) => p.image_url && !isNative(p.image_url));
console.log(
  `Mirroring ${targets.length} of ${products.length} products (skipping ${
    products.length - targets.length
  } already-native or empty)`
);

let mirrored = 0;
const failures = [];

for (const p of targets) {
  const sourceUrl = p.source_image_url || p.image_url;
  try {
    const res = await fetch(sourceUrl, { redirect: "follow" });
    if (!res.ok) {
      failures.push({ name: p.name, err: `fetch ${res.status}` });
      continue;
    }
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = extFromContentType(contentType);
    const buf = Buffer.from(await res.arrayBuffer());
    const baseSlug = slugify(p.item_code || p.name, String(p.id).slice(0, 8));
    const path = `${PREFIX}/${baseSlug}.${ext}`;

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, buf, { contentType, upsert: true, cacheControl: "31536000" });
    if (upErr) {
      failures.push({ name: p.name, err: upErr.message });
      continue;
    }

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);

    const { error: updErr } = await admin
      .from("products")
      .update({ image_url: pub.publicUrl, source_image_url: sourceUrl })
      .eq("id", p.id);
    if (updErr) {
      failures.push({ name: p.name, err: `db update: ${updErr.message}` });
      continue;
    }

    mirrored += 1;
    process.stdout.write(`  ✓ ${p.name}\n`);
  } catch (e) {
    failures.push({ name: p.name, err: String(e).slice(0, 120) });
  }
}

console.log(`\nDone. mirrored=${mirrored} failures=${failures.length}`);
if (failures.length > 0) {
  console.log("Failures:");
  for (const f of failures) console.log(` - ${f.name}: ${f.err}`);
  process.exit(1);
}
