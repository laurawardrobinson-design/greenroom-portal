import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "brand-assets";
const PREFIX = "products";

// Hosts we never need to re-mirror (already ours).
const NATIVE_HOSTS = [".supabase.co", ".supabase.in"];

function isNativeUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return NATIVE_HOSTS.some((h) => hostname.endsWith(h));
  } catch {
    return false;
  }
}

function extFromContentType(ct: string | null): string {
  if (!ct) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("svg")) return "svg";
  return "jpg";
}

function slugify(input: string, fallback: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || fallback;
}

export type MirrorResult = {
  imageUrl: string;
  sourceImageUrl: string;
};

/**
 * Mirror an external image URL into Supabase Storage.
 *
 * If sourceUrl already points at our own Storage, returns it unchanged.
 * Otherwise downloads the image, uploads to brand-assets/products/<key>.<ext>,
 * and returns the public Supabase URL.
 *
 * Throws on download/upload failure — callers decide whether to fail the save
 * or fall back to keeping the external URL.
 */
export async function mirrorProductImage(
  sourceUrl: string,
  pathKey: string
): Promise<MirrorResult> {
  if (isNativeUrl(sourceUrl)) {
    return { imageUrl: sourceUrl, sourceImageUrl: sourceUrl };
  }

  const res = await fetch(sourceUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`fetch ${res.status} from ${sourceUrl}`);

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const ext = extFromContentType(contentType);
  const buf = Buffer.from(await res.arrayBuffer());
  const key = slugify(pathKey, "image");
  const path = `${PREFIX}/${key}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, buf, { contentType, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`upload failed: ${error.message}`);

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return { imageUrl: data.publicUrl, sourceImageUrl: sourceUrl };
}

export function shouldMirror(url: string | null | undefined): boolean {
  if (!url) return false;
  if (!url.startsWith("http")) return false;
  return !isNativeUrl(url);
}
