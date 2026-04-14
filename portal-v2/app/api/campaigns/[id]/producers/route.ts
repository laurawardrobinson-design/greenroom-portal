import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guards";

import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: campaignId } = await params;
  const { userId } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const db = createAdminClient();

  const { error } = await db
    .from("campaign_producers")
    .insert({ campaign_id: campaignId, user_id: userId });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Keep producer_id in sync with the first producer
  const { data: rows } = await db
    .from("campaign_producers")
    .select("user_id")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true })
    .limit(1);

  await db
    .from("campaigns")
    .update({ producer_id: rows?.[0]?.user_id ?? null })
    .eq("id", campaignId);

  return NextResponse.json({ ok: true });
}
