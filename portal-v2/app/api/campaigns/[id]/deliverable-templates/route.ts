import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/campaigns/[id]/deliverable-templates
// Returns one row per deliverable on the campaign with its templating
// workflow stage and (if one exists) a link to the template being built.
// Used by the "Deliverables to template" tile on campaign detail so a
// Producer can see at a glance how the designer is progressing.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Designer",
      "Art Director",
      "Creative Director",
    ]);
    const { id: campaignId } = await params;
    const db = createAdminClient();

    const { data: deliverables, error: delError } = await db
      .from("campaign_deliverables")
      .select(
        "id, channel, format, width, height, aspect_ratio, quantity, assigned_designer_id"
      )
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });

    if (delError) throw delError;
    if (!deliverables || deliverables.length === 0) {
      return NextResponse.json({ items: [], summary: { total: 0, ready: 0, drafting: 0, needsTemplate: 0 } });
    }

    const deliverableIds = deliverables.map((d) => d.id as string);

    const [wfRes, tmplRes] = await Promise.all([
      db
        .from("workflow_instances")
        .select("entity_id, current_stage, status, updated_at")
        .eq("entity_type", "deliverable")
        .in("entity_id", deliverableIds),
      db
        .from("templates")
        .select("id, name, status, campaign_deliverable_id, updated_at")
        .in("campaign_deliverable_id", deliverableIds),
    ]);

    if (wfRes.error) throw wfRes.error;
    if (tmplRes.error) throw tmplRes.error;

    const wfByDeliverable = new Map<string, { stage: string; status: string; updatedAt: string }>();
    for (const row of wfRes.data ?? []) {
      wfByDeliverable.set(row.entity_id as string, {
        stage: (row.current_stage as string) ?? "needs_template",
        status: (row.status as string) ?? "active",
        updatedAt: (row.updated_at as string) ?? "",
      });
    }

    const tmplByDeliverable = new Map<string, { id: string; name: string; status: string; updatedAt: string }>();
    for (const row of tmplRes.data ?? []) {
      const key = row.campaign_deliverable_id as string | null;
      if (!key) continue;
      // If multiple templates exist for the same deliverable (shouldn't happen,
      // but defensive), keep the most recently updated.
      const existing = tmplByDeliverable.get(key);
      const updatedAt = (row.updated_at as string) ?? "";
      if (!existing || updatedAt > existing.updatedAt) {
        tmplByDeliverable.set(key, {
          id: row.id as string,
          name: (row.name as string) ?? "",
          status: (row.status as string) ?? "draft",
          updatedAt,
        });
      }
    }

    const items = deliverables.map((d) => {
      const id = d.id as string;
      const wf = wfByDeliverable.get(id);
      const tmpl = tmplByDeliverable.get(id);
      return {
        deliverableId: id,
        channel: (d.channel as string) ?? "",
        format: (d.format as string) ?? "",
        width: Number(d.width ?? 0),
        height: Number(d.height ?? 0),
        aspectRatio: (d.aspect_ratio as string) ?? "",
        quantity: Number(d.quantity ?? 1),
        assignedDesignerId: (d.assigned_designer_id as string | null) ?? null,
        workflowStage: wf?.stage ?? "not_started",
        templateId: tmpl?.id ?? null,
        templateName: tmpl?.name ?? null,
        templateStatus: tmpl?.status ?? null,
        updatedAt: wf?.updatedAt ?? null,
      };
    });

    const summary = items.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.workflowStage === "template_ready") acc.ready += 1;
        else if (item.workflowStage === "drafting") acc.drafting += 1;
        else acc.needsTemplate += 1;
        return acc;
      },
      { total: 0, ready: 0, drafting: 0, needsTemplate: 0 }
    );

    return NextResponse.json({ items, summary });
  } catch (error) {
    return authErrorResponse(error);
  }
}
