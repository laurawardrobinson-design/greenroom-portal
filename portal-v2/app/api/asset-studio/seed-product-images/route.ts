import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

// Node runtime — we fetch remote URLs and upload to storage in sequence.
// 30 products × ~200ms each = generous ceiling.
export const runtime = "nodejs";
export const maxDuration = 120;

function slugify(input: string, fallback: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}

function extFromContentType(ct: string, fallback = "jpg"): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  return fallback;
}

/**
 * POST /api/asset-studio/seed-product-images
 *
 * One-shot seeder: walks the `products` table, downloads each product's
 * image_url, and uploads it into the `brand-assets` bucket under
 * `products/<slug>.<ext>`. Safe to re-run — uses `upsert: true`.
 *
 * Returns: { total, seeded, skipped, failures: Array<{ productName, err }> }
 *
 * Admin / Producer / Designer only. Idempotent; upload uses upsert so
 * re-running overwrites in-place without orphaning old rows.
 */
export async function POST() {
  try {
    await requireRole(["Admin", "Producer", "Designer"]);

    const admin = createAdminClient();

    // Pull every product that has an image_url to mirror.
    const { data: products, error: pErr } = await admin
      .from("products")
      .select("id, name, image_url, item_code")
      .not("image_url", "is", null);
    if (pErr) throw pErr;

    const total = products?.length ?? 0;
    let seeded = 0;
    let skipped = 0;
    const failures: Array<{ productName: string; err: string }> = [];
    const seededUrls: Array<{ productName: string; publicUrl: string }> = [];

    for (const p of products ?? []) {
      const name = (p.name as string) ?? "unknown";
      const url = p.image_url as string;
      if (!url || !url.startsWith("http")) {
        skipped += 1;
        continue;
      }
      try {
        const res = await fetch(url);
        if (!res.ok) {
          failures.push({ productName: name, err: `fetch ${res.status}` });
          continue;
        }
        const contentType = res.headers.get("content-type") || "image/jpeg";
        const ext = extFromContentType(contentType);
        const buf = Buffer.from(await res.arrayBuffer());
        const baseSlug = slugify(
          (p.item_code as string | null) || name,
          String(p.id).slice(0, 8)
        );
        const path = `products/${baseSlug}.${ext}`;

        const { error: uploadErr } = await admin.storage
          .from("brand-assets")
          .upload(path, buf, {
            contentType,
            upsert: true,
            cacheControl: "31536000",
          });
        if (uploadErr) {
          failures.push({ productName: name, err: uploadErr.message });
          continue;
        }
        const { data: urlData } = admin.storage
          .from("brand-assets")
          .getPublicUrl(path);
        seededUrls.push({ productName: name, publicUrl: urlData.publicUrl });
        seeded += 1;
      } catch (err) {
        failures.push({
          productName: name,
          err: (err as Error).message ?? "unknown",
        });
      }
    }

    return NextResponse.json({
      total,
      seeded,
      skipped,
      failureCount: failures.length,
      failures,
      seededUrls,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
