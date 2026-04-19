import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  createOutputSpec,
  ensureDefaultOutputSpecs,
  getTemplate,
} from "@/lib/services/templates.service";
import { getPresetByCode } from "@/lib/asset-studio/size-presets";

type RouteCtx = { params: Promise<{ id: string }> };

// POST /api/asset-studio/templates/:id/output-specs
// body: { label, width, height, channel?, format?, sortOrder? }   — single spec
//   OR  { ensureDefaults: true }                                    — seed Storyteq defaults
//   OR  { presetCodes: string[] }                                   — bulk-add POP / digital presets
export async function POST(request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const { id: templateId } = await ctx.params;
    const body = (await request.json()) as {
      ensureDefaults?: boolean;
      presetCodes?: string[];
      label?: string;
      width?: number;
      height?: number;
      channel?: string;
      format?: "png" | "jpg" | "webp";
      sortOrder?: number;
    };

    if (body.ensureDefaults) {
      const created = await ensureDefaultOutputSpecs(templateId);
      return NextResponse.json({ created }, { status: 201 });
    }

    if (Array.isArray(body.presetCodes) && body.presetCodes.length > 0) {
      // Resolve presets from the library. Unknown codes are skipped and
      // returned in `skipped` so the UI can surface them.
      const requested = body.presetCodes;
      const resolved = requested
        .map((code) => ({ code, preset: getPresetByCode(code) }))
        .filter((r) => r.preset)
        .map((r) => r.preset!);
      const skipped = requested.filter((code) => !getPresetByCode(code));

      if (resolved.length === 0) {
        return NextResponse.json(
          { error: "No valid preset codes supplied", skipped },
          { status: 400 }
        );
      }

      // De-dup against existing specs on the template. Match by (width,height,label)
      // to avoid double-adding the same size when a designer clicks twice.
      const existing = await getTemplate(templateId);
      const existingKeys = new Set(
        (existing?.outputSpecs ?? []).map(
          (s) => `${s.label}|${s.width}x${s.height}`
        )
      );

      // Compute a sortOrder starting point so new presets append after existing.
      const existingMax = (existing?.outputSpecs ?? []).reduce(
        (m, s) => Math.max(m, s.sortOrder),
        0
      );

      const created = [] as Array<ReturnType<typeof String>>;
      const duplicates = [] as string[];
      for (let i = 0; i < resolved.length; i++) {
        const p = resolved[i];
        const key = `${p.label}|${p.width}x${p.height}`;
        if (existingKeys.has(key)) {
          duplicates.push(p.code);
          continue;
        }
        const spec = await createOutputSpec({
          templateId,
          label: p.label,
          width: p.width,
          height: p.height,
          channel: p.channel,
          format: p.format,
          sortOrder: existingMax + 10 * (i + 1),
        });
        created.push(spec.id);
      }
      return NextResponse.json(
        { created: created.length, duplicates, skipped },
        { status: 201 }
      );
    }

    if (!body.label || !body.width || !body.height) {
      return NextResponse.json(
        { error: "label, width, height are required" },
        { status: 400 }
      );
    }
    const spec = await createOutputSpec({
      templateId,
      label: body.label,
      width: body.width,
      height: body.height,
      channel: body.channel,
      format: body.format,
      sortOrder: body.sortOrder,
    });
    return NextResponse.json(spec, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
