import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/campaigns/[id]/schedule
// Returns shots with their date assignments for the schedule views
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Studio", "Creative Director"]);
    const { id: campaignId } = await params;
    const db = createAdminClient();

    // Fetch setups + shots + deliverable links
    const { data: setups, error: setupErr } = await db
      .from("shot_list_setups")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("sort_order", { ascending: true });

    if (setupErr) throw setupErr;

    const { data: shots, error: shotErr } = await db
      .from("shot_list_shots")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("sort_order", { ascending: true });

    if (shotErr) throw shotErr;

    // Deliverable links + product links + talent
    const shotIds = (shots || []).map((s) => s.id);
    let links: Record<string, unknown>[] = [];
    let productLinks: Record<string, unknown>[] = [];
    let talentEntries: Record<string, unknown>[] = [];
    if (shotIds.length > 0) {
      const [linkRes, prodRes, talentRes] = await Promise.all([
        db.from("shot_deliverable_links").select("*").in("shot_id", shotIds),
        db.from("shot_product_links").select("*").in("shot_id", shotIds),
        db.from("shot_talent").select("*").in("shot_id", shotIds).order("talent_number"),
      ]);
      links = (linkRes.data || []) as Record<string, unknown>[];
      productLinks = (prodRes.data || []) as Record<string, unknown>[];
      talentEntries = (talentRes.data || []) as Record<string, unknown>[];
    }

    // Deliverables + campaign products
    const [delRes, cpRes] = await Promise.all([
      db.from("campaign_deliverables").select("*").eq("campaign_id", campaignId),
      db.from("campaign_products").select("*, product:products(*)").eq("campaign_id", campaignId),
    ]);

    // Approver lookup — so the shot list popover can show who signed off
    // without a second round-trip per row.
    const approverIds = Array.from(
      new Set(
        (shots || [])
          .map((s) => (s as Record<string, unknown>).approved_by as string | null)
          .filter((id): id is string => !!id)
      )
    );
    let approvers: Array<{ id: string; name: string }> = [];
    if (approverIds.length > 0) {
      const { data: users } = await db
        .from("users")
        .select("id, name")
        .in("id", approverIds);
      approvers = (users || []) as Array<{ id: string; name: string }>;
    }

    // Day events (company moves, meals, wrap) — scoped to this campaign's shoot dates
    const { data: campaignShootDates } = await db
      .from("shoot_dates")
      .select("id, shoot_id, shoots!inner(campaign_id)")
      .eq("shoots.campaign_id", campaignId);
    const shootDateIds = (campaignShootDates || []).map((d) => d.id);
    let dayEvents: Record<string, unknown>[] = [];
    if (shootDateIds.length > 0) {
      const { data: ev } = await db
        .from("shoot_day_events")
        .select("*")
        .in("shoot_date_id", shootDateIds)
        .order("sort_order_in_day", { ascending: true });
      dayEvents = (ev || []) as Record<string, unknown>[];
    }

    return NextResponse.json({
      setups: setups || [],
      shots: shots || [],
      links: links,
      productLinks: productLinks,
      talent: talentEntries,
      deliverables: delRes.data || [],
      campaignProducts: cpRes.data || [],
      approvers,
      dayEvents,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/campaigns/[id]/schedule
// Bulk update shot schedule assignments (date, duration, order)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director"]);
    const { id: campaignId } = await params;
    const db = createAdminClient();
    const body = await request.json();

    // Update individual shot fields
    if (body.shotId) {
      const update: Record<string, unknown> = {};
      if (body.shootDateId !== undefined) update.shoot_date_id = body.shootDateId;
      if (body.estimatedDurationMinutes !== undefined) update.estimated_duration_minutes = body.estimatedDurationMinutes;
      if (body.sortOrderInDay !== undefined) update.sort_order_in_day = body.sortOrderInDay;
      if (body.intExt !== undefined) update.int_ext = body.intExt;

      const { error } = await db
        .from("shot_list_shots")
        .update(update)
        .eq("id", body.shotId)
        .eq("campaign_id", campaignId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // Day events (company move / lunch / wrap)
    if (body.event) {
      const e = body.event;
      if (e.action === "create") {
        const { error } = await db.from("shoot_day_events").insert({
          shoot_date_id: e.shootDateId,
          type: e.type,
          label: e.label || "",
          time: e.time || null,
          sort_order_in_day: e.sortOrderInDay ?? 9999,
        });
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
      if (e.action === "delete") {
        const { error } = await db
          .from("shoot_day_events")
          .delete()
          .eq("id", e.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
      if (e.action === "update") {
        const update: Record<string, unknown> = {};
        if (e.label !== undefined) update.label = e.label;
        if (e.time !== undefined) update.time = e.time;
        if (e.sortOrderInDay !== undefined) update.sort_order_in_day = e.sortOrderInDay;
        const { error } = await db
          .from("shoot_day_events")
          .update(update)
          .eq("id", e.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
    }

    // Bulk reorder shots within a day
    if (body.reorder && Array.isArray(body.reorder)) {
      for (const item of body.reorder) {
        await db
          .from("shot_list_shots")
          .update({
            sort_order_in_day: item.sortOrderInDay,
            shoot_date_id: item.shootDateId,
          })
          .eq("id", item.shotId)
          .eq("campaign_id", campaignId);
      }
      return NextResponse.json({ success: true });
    }

    // Update shoot_date fields (call sheet overrides)
    if (body.shootDateId && body.dateFields) {
      const update: Record<string, unknown> = {};
      const fields = body.dateFields;
      if (fields.notesForCrew !== undefined) update.notes_for_crew = fields.notesForCrew;
      if (fields.parkingDirections !== undefined) update.parking_directions = fields.parkingDirections;
      if (fields.weatherNotes !== undefined) update.weather_notes = fields.weatherNotes;
      if (fields.specialInstructions !== undefined) update.special_instructions = fields.specialInstructions;
      if (fields.callSheetOverrides !== undefined) update.call_sheet_overrides = fields.callSheetOverrides;

      const { error } = await db
        .from("shoot_dates")
        .update(update)
        .eq("id", body.shootDateId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
