// One-shot seeder: downloads each product's image_url from the Publix CDN
// and uploads it into the `brand-assets` bucket under products/<slug>.<ext>.
// Safe to re-run — upsert:true. NOT tracked in git long-term; this is
// a one-off convenience script (gitignored under scripts/seed-*.mjs if you
// want — for now we just leave it in place for future re-runs).
//
// Run with:
//   node --env-file=.env.local portal-v2/scripts/seed-product-images.mjs

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

function slugify(input, fallback) {
  const slug = String(input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}

function extFromContentType(ct, fallback = "jpg") {
  if (!ct) return fallback;
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  return fallback;
}

const { data: products, error: pErr } = await admin
  .from("products")
  .select("id, name, image_url, item_code")
  .not("image_url", "is", null);
if (pErr) {
  console.error("Failed to read products:", pErr);
  process.exit(1);
}

console.log(`Seeding ${products.length} product images → brand-assets/products/`);

let seeded = 0;
let skipped = 0;
const failures = [];
const seededUrls = [];

for (const p of products) {
  const name = p.name ?? "unknown";
  const url = p.image_url;
  if (!url || !url.startsWith("http")) {
    skipped += 1;
    continue;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) {
      failures.push({ name, err: `fetch ${res.status}` });
      continue;
    }
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = extFromContentType(contentType);
    const buf = Buffer.from(await res.arrayBuffer());
    const baseSlug = slugify(p.item_code || name, String(p.id).slice(0, 8));
    const path = `products/${baseSlug}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("brand-assets")
      .upload(path, buf, { contentType, upsert: true, cacheControl: "31536000" });
    if (upErr) {
      failures.push({ name, err: upErr.message });
      continue;
    }
    const { data: urlData } = admin.storage.from("brand-assets").getPublicUrl(path);
    seededUrls.push({ name, publicUrl: urlData.publicUrl });
    seeded += 1;
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (e) {
    failures.push({ name, err: String(e).slice(0, 120) });
  }
}

console.log(`\nDone. seeded=${seeded} skipped=${skipped} failures=${failures.length}`);
if (failures.length > 0) {
  console.log("Failures:");
  for (const f of failures) console.log(` - ${f.name}: ${f.err}`);
}
if (seededUrls.length > 0) {
  console.log("\nFirst 3 URLs:");
  for (const s of seededUrls.slice(0, 3)) {
    console.log(` - ${s.name}`);
    console.log(`   ${s.publicUrl}`);
  }
}
