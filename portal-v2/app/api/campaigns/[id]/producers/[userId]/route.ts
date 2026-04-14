import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: campaignId, userId } = await params;
  const { campaignRole } = await req.json();
  const db = createAdminClient();

  const { error } = await db
    .from("campaign_producers")
    .update({ campaign_role: campaignRole ?? null })
    .eq("campaign_id", campaignId)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: campaignId, userId } = await params;
  const db = createAdminClient();

  await db
    .from("campaign_producers")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("user_id", userId);

  // Keep producer_id in sync with the new first producer (or null)
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
