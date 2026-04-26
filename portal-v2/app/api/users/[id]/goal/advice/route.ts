import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (user.role === "Vendor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const { text } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Find the goal for this user
    const { data: goal, error: goalError } = await supabase
      .from("user_goals")
      .select("id")
      .eq("user_id", id)
      .single();

    if (goalError || !goal) {
      return NextResponse.json({ error: "No goal found for this user" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("goal_advice")
      .insert({
        goal_id: goal.id,
        text: text.trim(),
        author_id: user.id,
        author_name: (user.name && user.name.trim()) ? user.name.trim() : user.email,
      })
      .select("id, text, author_id, author_name, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        id: data.id,
        text: data.text,
        authorId: data.author_id,
        authorName: data.author_name,
        createdAt: data.created_at,
      },
      { status: 201 }
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
