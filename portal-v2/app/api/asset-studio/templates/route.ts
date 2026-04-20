import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listTemplates,
  createTemplate,
  createLayer,
  ensureDefaultOutputSpecs,
} from "@/lib/services/templates.service";
import { advanceWorkflowTransition } from "@/lib/services/workflow.service";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TemplateStatus } from "@/types/domain";
import {
  createTemplateSchema,
  parseBody,
} from "@/lib/validation/asset-studio";

// GET /api/asset-studio/templates
export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer", "Art Director", "Creative Director"]);
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") as TemplateStatus | null) || undefined;
    const search = searchParams.get("search") || undefined;
    const templates = await listTemplates({ status, search });
    return NextResponse.json(templates);
  } catch (error) {
    return authErrorResponse(error);
  }
}

interface DeliverablePrefill {
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  campaignDeliverableId: string;
  brandTokensId: string | null;
  copy: {
    headline: string;
    cta: string;
    disclaimer: string;
    legal: string;
  };
}

// Default layout percentages for prefilled text layers. These are
// starting positions — designer repositions as needed. Tuned for the
// most common 1:1 / 4:5 / 9:16 social formats.
const DEFAULT_LAYER_POSITIONS = {
  headline:   { xPct: 6,  yPct: 8,  widthPct: 88, heightPct: 18, fontSize: 64, fontWeight: 700 },
  cta:        { xPct: 6,  yPct: 76, widthPct: 88, heightPct: 10, fontSize: 40, fontWeight: 600 },
  disclaimer: { xPct: 6,  yPct: 87, widthPct: 88, heightPct: 5,  fontSize: 18, fontWeight: 400 },
  legal:      { xPct: 6,  yPct: 93, widthPct: 88, heightPct: 5,  fontSize: 14, fontWeight: 400 },
} as const;

async function resolveDeliverablePrefill(
  deliverableId: string
): Promise<DeliverablePrefill> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_deliverables")
    .select(
      `id, channel, format, width, height,
       headline_override, cta_override, disclaimer_override, legal_override,
       campaigns(wf_number, name, brand, headline, cta, disclaimer, legal)`
    )
    .eq("id", deliverableId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Deliverable ${deliverableId} not found`);
  }

  const campaign =
    (data.campaigns as {
      wf_number?: string;
      name?: string;
      brand?: string;
      headline?: string;
      cta?: string;
      disclaimer?: string;
      legal?: string;
    } | null) ?? null;

  const channel = (data.channel as string) || "Deliverable";
  const format = (data.format as string) || "";
  const width = Number(data.width) || 1080;
  const height = Number(data.height) || 1080;
  const wfPart = campaign?.wf_number ? `${campaign.wf_number} — ` : "";
  const label = [channel, format].filter(Boolean).join(" ");
  const name = `${wfPart}${label} (${width}×${height})`.trim();

  // Copy: deliverable override wins, else campaign, else empty.
  const coalesceString = (override: unknown, fallback: unknown): string => {
    if (typeof override === "string") return override;
    return (fallback as string) ?? "";
  };

  const copy = {
    headline: coalesceString(data.headline_override, campaign?.headline),
    cta: coalesceString(data.cta_override, campaign?.cta),
    disclaimer: coalesceString(data.disclaimer_override, campaign?.disclaimer),
    legal: coalesceString(data.legal_override, campaign?.legal),
  };

  // Brand tokens: prefer the active set for the campaign's brand.
  // Falls back to Publix (default seed) and finally to any active set,
  // so a new brand with no tokens yet still gets *something* locked in.
  let brandTokensId: string | null = null;
  const brandCandidates = [
    campaign?.brand && campaign.brand.length > 0 ? campaign.brand : null,
    "Publix",
  ].filter((v): v is string => Boolean(v));

  for (const candidate of brandCandidates) {
    const { data: tokensRow } = await db
      .from("brand_tokens")
      .select("id")
      .eq("brand", candidate)
      .eq("is_active", true)
      .maybeSingle();
    if (tokensRow) {
      brandTokensId = tokensRow.id as string;
      break;
    }
  }

  if (!brandTokensId) {
    // Last-resort fallback: any active set.
    const { data: anyActive } = await db
      .from("brand_tokens")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (anyActive) brandTokensId = anyActive.id as string;
  }

  return {
    name,
    canvasWidth: width,
    canvasHeight: height,
    campaignDeliverableId: data.id as string,
    brandTokensId,
    copy,
  };
}

async function seedDeliverableLayers(
  templateId: string,
  copy: DeliverablePrefill["copy"]
): Promise<void> {
  // Four dynamic text layers bound to copy.* paths. The existing run
  // builder already knows how to resolve these from campaign fields
  // at render time (runs/new/page.tsx:195). Static value doubles as
  // the editor preview and as the fallback when no override is set.
  const specs: Array<{
    name: string;
    binding: "copy.headline" | "copy.cta" | "copy.disclaimer" | "copy.legal";
    staticValue: string;
    pos: typeof DEFAULT_LAYER_POSITIONS[keyof typeof DEFAULT_LAYER_POSITIONS];
    sort: number;
  }> = [
    { name: "Headline",   binding: "copy.headline",   staticValue: copy.headline,   pos: DEFAULT_LAYER_POSITIONS.headline,   sort: 10 },
    { name: "CTA",        binding: "copy.cta",        staticValue: copy.cta,        pos: DEFAULT_LAYER_POSITIONS.cta,        sort: 20 },
    { name: "Disclaimer", binding: "copy.disclaimer", staticValue: copy.disclaimer, pos: DEFAULT_LAYER_POSITIONS.disclaimer, sort: 30 },
    { name: "Legal",      binding: "copy.legal",      staticValue: copy.legal,      pos: DEFAULT_LAYER_POSITIONS.legal,      sort: 40 },
  ];

  for (const spec of specs) {
    await createLayer({
      templateId,
      name: spec.name,
      layerType: "text",
      isDynamic: true,
      isLocked: false,
      dataBinding: spec.binding,
      staticValue: spec.staticValue,
      xPct: spec.pos.xPct,
      yPct: spec.pos.yPct,
      widthPct: spec.pos.widthPct,
      heightPct: spec.pos.heightPct,
      sortOrder: spec.sort,
      zIndex: spec.sort,
      props: {
        fontSize: spec.pos.fontSize,
        fontWeight: spec.pos.fontWeight,
        textAlign: "left",
        color: "#111111",
      },
    });
  }
}

// POST /api/asset-studio/templates
// body: { name?, description?, category?, brandTokensId?, canvasWidth?, canvasHeight?,
//         backgroundColor?, seedDefaultSpecs?, deliverableId? }
// When deliverableId is provided, canvas + name are derived from the
// deliverable, the template is back-linked, and the deliverable workflow
// advances needs_template → drafting.
export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const raw = await request.json().catch(() => ({}));
    const parsed = parseBody(raw, createTemplateSchema);
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 });
    }
    const body = parsed.data;

    let prefill: DeliverablePrefill | null = null;
    if (body.deliverableId) {
      prefill = await resolveDeliverablePrefill(body.deliverableId);
    }

    const name = body.name ?? prefill?.name;
    if (!name || name.length === 0) {
      return NextResponse.json(
        { error: "name required (or pass deliverableId to derive one)" },
        { status: 400 }
      );
    }

    const template = await createTemplate({
      name,
      description: body.description,
      category: body.category,
      // Campaign brand tokens beat the client-supplied value when we
      // have a deliverable context — the deliverable is authoritative
      // for which brand the designer should be working in.
      brandTokensId: prefill?.brandTokensId ?? body.brandTokensId,
      canvasWidth: body.canvasWidth ?? prefill?.canvasWidth,
      canvasHeight: body.canvasHeight ?? prefill?.canvasHeight,
      backgroundColor: body.backgroundColor,
      campaignDeliverableId: prefill?.campaignDeliverableId ?? null,
      createdBy: user.id,
    });

    if (body.seedDefaultSpecs !== false) {
      await ensureDefaultOutputSpecs(template.id);
    }

    // Prefill text layers bound to copy.headline/cta/disclaimer/legal,
    // with the resolved campaign+deliverable copy as static values.
    // Designer can delete, re-bind, or reposition any of these.
    if (prefill) {
      try {
        await seedDeliverableLayers(template.id, prefill.copy);
      } catch (layerError) {
        console.error("Failed to seed deliverable layers:", layerError);
      }
    }

    // Advance the deliverable workflow to "drafting" so the card in
    // My Work reflects that the designer has started. Fire-and-forget;
    // don't fail the template creation on workflow bookkeeping issues.
    if (prefill && (user.role === "Designer" || user.role === "Admin")) {
      try {
        await advanceWorkflowTransition({
          entityType: "deliverable",
          entityId: prefill.campaignDeliverableId,
          action: "start_drafting",
          actorId: user.id,
          actorRole: user.role,
          reason: "Designer started templating",
          metadata: { templateId: template.id, source: "templates.route.POST" },
        });
      } catch (wfError) {
        console.error("Failed to advance deliverable workflow:", wfError);
      }
    }

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
