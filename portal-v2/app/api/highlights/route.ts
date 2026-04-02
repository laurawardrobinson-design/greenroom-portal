import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await getAuthUser();
    const db = createAdminClient();
    const { data, error } = await db
      .from("highlights")
      .select("id, title, body, emoji, pinned, created_at")
      .eq("active", true)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6);
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole(["Admin"]);
    const { title, body, emoji } = await req.json();
    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: "Title and body required" }, { status: 400 });
    }
    const db = createAdminClient();
    const { data, error } = await db
      .from("highlights")
      .insert({
        title: title.trim(),
        body: body.trim(),
        emoji: emoji || "🌟",
        created_by: user.id,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
