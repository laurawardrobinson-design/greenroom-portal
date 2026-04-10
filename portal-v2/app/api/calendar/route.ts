import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/calendar?month=2026-03
export async function GET(request: Request) {
  try {
    await getAuthUser();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // YYYY-MM format

    const db = createAdminClient();

    let query = db
      .from("shoot_dates")
      .select("*, shoots!inner(id, name, shoot_type, campaign_id, campaigns(id, name, wf_number, status, producer_id, users!campaigns_producer_id_fkey(id, name)))")
      .order("shoot_date");

    const from = searchParams.get("from");
    if (from) {
      query = query.gte("shoot_date", from);
    } else if (month) {
      const start = `${month}-01`;
      const [year, m] = month.split("-").map(Number);
      const lastDay = new Date(year, m, 0).getDate();
      const end = `${month}-${lastDay}`;
      query = query.gte("shoot_date", start).lte("shoot_date", end);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Fetch per-day crew headcount via crew_booking_dates
    let crewQuery = db
      .from("crew_booking_dates")
      .select("shoot_date, crew_bookings!inner(campaign_id)");
    if (from) {
      crewQuery = crewQuery.gte("shoot_date", from);
    } else if (month) {
      const start = `${month}-01`;
      const [year, m] = month.split("-").map(Number);
      const lastDay = new Date(year, m, 0).getDate();
      crewQuery = crewQuery.gte("shoot_date", start).lte("shoot_date", `${month}-${lastDay}`);
    }
    const { data: crewData } = await crewQuery;

    // Build headcount map: "campaignId|date" → count
    const headcountMap = new Map<string, number>();
    for (const row of crewData || []) {
      const campaignId = (row.crew_bookings as any)?.campaign_id;
      if (!campaignId) continue;
      const key = `${campaignId}|${row.shoot_date}`;
      headcountMap.set(key, (headcountMap.get(key) || 0) + 1);
    }

    const events = (data || []).map((row) => {
      const shoot = row.shoots as Record<string, unknown>;
      const campaign = shoot?.campaigns as Record<string, unknown> | null;
      const producer = campaign?.users as Record<string, unknown> | null;
      const campaignId = campaign?.id as string | null;
      const vendorCount = campaignId
        ? (headcountMap.get(`${campaignId}|${row.shoot_date}`) || 0)
        : 0;

      return {
        id: row.id,
        date: row.shoot_date,
        location: row.location || (shoot?.location as string) || "",
        callTime: row.call_time,
        notes: row.notes,
        shootName: (shoot?.name as string) || "",
        shootType: (shoot?.shoot_type as string) || "",
        vendorCount,
        campaign: campaign
          ? {
              id: campaign.id,
              name: campaign.name,
              wfNumber: campaign.wf_number,
              status: campaign.status,
              producerId: campaign.producer_id as string | null,
              producerName: producer ? (producer.name as string) : null,
            }
          : null,
      };
    });

    return NextResponse.json(events);
  } catch (error) {
    return authErrorResponse(error);
  }
}
