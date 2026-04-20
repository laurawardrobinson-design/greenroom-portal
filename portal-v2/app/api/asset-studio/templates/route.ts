import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listTemplates,
  createTemplate,
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
}

async function resolveDeliverablePrefill(
  deliverableId: string
): Promise<DeliverablePrefill> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_deliverables")
    .select(
      "id, channel, format, width, height, campaigns(wf_number, name)"
    )
    .eq("id", deliverableId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Deliverable ${deliverableId} not found`);
  }

  const campaign = (data.campaigns as { wf_number?: string; name?: string } | null) ?? null;
  const channel = (data.channel as string) || "Deliverable";
  const format = (data.format as string) || "";
  const width = Number(data.width) || 1080;
  const height = Number(data.height) || 1080;
  const wfPart = campaign?.wf_number ? `${campaign.wf_number} — ` : "";
  const label = [channel, format].filter(Boolean).join(" ");
  const name = `${wfPart}${label} (${width}×${height})`.trim();

  return {
    name,
    canvasWidth: width,
    canvasHeight: height,
    campaignDeliverableId: data.id as string,
  };
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
      brandTokensId: body.brandTokensId,
      canvasWidth: body.canvasWidth ?? prefill?.canvasWidth,
      canvasHeight: body.canvasHeight ?? prefill?.canvasHeight,
      backgroundColor: body.backgroundColor,
      campaignDeliverableId: prefill?.campaignDeliverableId ?? null,
      createdBy: user.id,
    });

    if (body.seedDefaultSpecs !== false) {
      await ensureDefaultOutputSpecs(template.id);
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
