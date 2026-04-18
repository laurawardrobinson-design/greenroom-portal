import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

// Node runtime — we handle FormData + file buffers. Storage upload is
// small so no special maxDuration is needed.
export const runtime = "nodejs";

const ALLOWED_BUCKETS = ["brand-assets", "templates"] as const;
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number];

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "font/woff",
  "font/woff2",
  "font/ttf",
  "font/otf",
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — storage buckets allow 50MB but
                                     // UI uploads are usually logos/source imagery

function slugify(input: string, fallback: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || fallback;
}

/**
 * POST /api/asset-studio/uploads
 *
 * multipart/form-data body:
 *   - file: the asset (image/font)
 *   - bucket: "brand-assets" (default) | "templates"
 *   - prefix: optional string path segment (e.g. "logos", "backgrounds")
 *
 * Returns: { publicUrl, storagePath, bucket, size, contentType }
 *
 * Scoped to upload-capable roles. Uses the admin client so the upload
 * happens with service-role privileges — the RLS policies on storage.objects
 * are already role-gated at the API layer via requireRole.
 */
export async function POST(request: Request) {
  try {
    const user = await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Designer",
    ]);

    const form = await request.formData();
    const file = form.get("file");
    const bucketInput = (form.get("bucket") ?? "brand-assets") as string;
    const prefixInput = (form.get("prefix") ?? "") as string;

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "file field is required and must be a File" },
        { status: 400 }
      );
    }
    if (!ALLOWED_BUCKETS.includes(bucketInput as AllowedBucket)) {
      return NextResponse.json(
        { error: `bucket must be one of ${ALLOWED_BUCKETS.join(", ")}` },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large (${file.size} > ${MAX_BYTES})` },
        { status: 413 }
      );
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported type ${file.type}` },
        { status: 415 }
      );
    }

    const admin = createAdminClient();
    const ts = Date.now();
    const prefix = prefixInput ? `${slugify(prefixInput, "misc")}/` : "";
    const filename = slugify(file.name || "upload", "upload");
    const storagePath = `${prefix}${user.id}/${ts}-${filename}`;

    const arrayBuf = await file.arrayBuffer();
    const { error: uploadErr } = await admin.storage
      .from(bucketInput)
      .upload(storagePath, Buffer.from(arrayBuf), {
        contentType: file.type,
        upsert: false,
        cacheControl: "31536000",
      });
    if (uploadErr) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = admin.storage.from(bucketInput).getPublicUrl(storagePath);

    return NextResponse.json(
      {
        publicUrl: urlData.publicUrl,
        storagePath,
        bucket: bucketInput,
        size: file.size,
        contentType: file.type,
      },
      { status: 201 }
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
