import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { parseRunCsv } from "@/lib/services/run-csv.service";
import { getTemplate } from "@/lib/services/templates.service";
import { z } from "zod";
import { parseBody } from "@/lib/validation/asset-studio";

// POST /api/asset-studio/runs/parse-csv
// body: { templateId: uuid, campaignId: uuid, csvText: string }
//
// Stateless — parses + matches, does NOT create a run. The UI uses the
// response to set selectedProducts + perProductCopy, then the user still
// clicks "Create & render".

const schema = z.object({
  templateId: z.string().uuid(),
  campaignId: z.string().uuid(),
  csvText: z.string().max(1_000_000), // 1 MB cap, matches typical upload limit
});

export async function POST(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const raw = await request.json().catch(() => ({}));
    const parsed = parseBody(raw, schema);
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 });
    }
    const { templateId, campaignId, csvText } = parsed.data;

    // Resolve the template's dynamic bindings so we can filter header columns.
    const template = await getTemplate(templateId);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    const allowedBindings = Array.from(
      new Set(
        (template.layers ?? [])
          .filter(
            (l) =>
              l.layerType === "text" &&
              l.isDynamic &&
              l.dataBinding &&
              l.dataBinding.trim() !== ""
          )
          .map((l) => l.dataBinding)
      )
    );

    const result = await parseRunCsv({ csvText, campaignId, allowedBindings });
    return NextResponse.json(result);
  } catch (error) {
    // Parser errors throw Error with a clean message; surface as 400 so the
    // UI can toast without digging into stacks.
    if (error instanceof Error && !("statusCode" in error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
