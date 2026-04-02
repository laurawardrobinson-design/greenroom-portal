import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthUser();
    const { id } = await params;
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("vendor_praise_notes")
      .select("id, text, author_id, author_name, created_at")
      .eq("vendor_id", id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const mapped = (data ?? []).map((n) => ({
      id: n.id,
      text: n.text,
      authorId: n.author_id,
      authorName: n.author_name,
      createdAt: n.created_at,
    }));
    return NextResponse.json(mapped);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    const { text } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("vendor_praise_notes")
      .insert({
        vendor_id: id,
        text: text.trim(),
        author_id: user.id,
        author_name: (user.name && user.name.trim()) ? user.name.trim() : user.email,
      })
      .select("id, text, author_id, author_name, created_at")
      .single();
    if (error) throw error;
    return NextResponse.json({
      id: data.id,
      text: data.text,
      authorId: data.author_id,
      authorName: data.author_name,
      createdAt: data.created_at,
    }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
