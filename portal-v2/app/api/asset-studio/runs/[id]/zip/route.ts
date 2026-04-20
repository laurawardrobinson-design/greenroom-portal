import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import archiver from "archiver";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRun } from "@/lib/services/runs.service";
import type { Variant } from "@/types/domain";

// Streaming zip download: pulls each variant's bytes from the `variants`
// storage bucket and pipes them into an archive without buffering the whole
// thing in memory. Node runtime + generous maxDuration in case a run has
// 100+ variants.
export const runtime = "nodejs";
export const maxDuration = 300;

type RouteCtx = { params: Promise<{ id: string }> };

function slugify(input: string, fallback: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}

function extFromStoragePath(path: string | null, fallback = "png"): string {
  if (!path) return fallback;
  const m = path.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : fallback;
}

/**
 * GET /api/asset-studio/runs/:id/zip
 *
 * Query params:
 *   status=approved (default) | rendered | all
 *
 * Returns a streamed zip of the matching variants. Files are named
 *   <product-slug>/<spec-label>-<variant-id-short>.<ext>
 * so the producer can drop the folder straight into a delivery tool.
 */
export async function GET(request: Request, ctx: RouteCtx) {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Designer",
      "Art Director",
      "Creative Director",
    ]);
    const { id: runId } = await ctx.params;
    const url = new URL(request.url);
    const statusFilter = (url.searchParams.get("status") ?? "approved").toLowerCase();

    const run = await getRun(runId);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Filter to the variants we actually want in the zip.
    const allVariants = run.variants ?? [];
    const eligible = allVariants.filter((v: Variant) => {
      if (!v.storagePath) return false;
      if (statusFilter === "all") return v.status === "rendered" || v.status === "approved";
      if (statusFilter === "rendered") return v.status === "rendered" || v.status === "approved";
      return v.status === "approved";
    });

    if (eligible.length === 0) {
      return NextResponse.json(
        {
          error: "No variants match the requested status",
          hint:
            statusFilter === "approved"
              ? "Approve some variants first, or pass ?status=rendered to include everything that finished rendering."
              : undefined,
        },
        { status: 409 }
      );
    }

    const admin = createAdminClient();
    const archive = archiver("zip", { zlib: { level: 6 } });

    // Swallow archiver errors into the stream so the client gets a partial
    // zip rather than a hung connection. Archiver writes a warning marker
    // into the archive on error.
    archive.on("warning", (err) => {
      if ((err as { code?: string }).code !== "ENOENT") throw err;
    });

    // Kick off downloads + append sequentially so we don't hammer storage
    // with hundreds of parallel fetches. If we need speed later, bucket them.
    (async () => {
      try {
        for (const variant of eligible) {
          const { data: blob, error } = await admin.storage
            .from("variants")
            .download(variant.storagePath as string);
          if (error || !blob) {
            // Append an error marker file so the operator can see what failed.
            archive.append(
              Buffer.from(
                `Failed to download variant ${variant.id}: ${
                  error?.message ?? "unknown error"
                }\n`
              ),
              { name: `_errors/${variant.id}.txt` }
            );
            continue;
          }
          const bytes = Buffer.from(await blob.arrayBuffer());
          const productName = variant.product?.name ?? "unknown-product";
          const specLabel = variant.outputSpec?.label ?? `${variant.width}x${variant.height}`;
          const ext = extFromStoragePath(variant.storagePath, "png");
          const shortId = variant.id.slice(0, 8);
          const filename = `${slugify(productName, "product")}/${slugify(
            specLabel,
            "spec"
          )}-${shortId}.${ext}`;
          archive.append(bytes, { name: filename });
        }
        await archive.finalize();
      } catch (err) {
        archive.destroy(err as Error);
      }
    })();

    const runSlug = slugify(run.name || `run-${runId.slice(0, 8)}`, `run-${runId.slice(0, 8)}`);
    const webStream = Readable.toWeb(archive) as ReadableStream<Uint8Array>;

    return new Response(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${runSlug}-${statusFilter}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
