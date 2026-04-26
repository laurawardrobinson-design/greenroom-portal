import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGoalViewer } from "@/lib/services/goals.service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; highlightId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (user.role === "Vendor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id, highlightId } = await params;

    // Only stakeholders (not the owner) can leave feedback
    const canView = await isGoalViewer(id, user.id);
    if (!canView || user.id === id) {
      return NextResponse.json({ error: "Only stakeholders can leave feedback" }, { status: 403 });
    }

    const { text } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("goal_highlight_feedback")
      .insert({
        highlight_id: highlightId,
        text: text.trim(),
        author_id: user.id,
        author_name: (user.name && user.name.trim()) ? user.name.trim() : user.email,
      })
      .select("id, highlight_id, text, author_id, author_name, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({
      id: data.id,
      highlightId: data.highlight_id,
      text: data.text,
      authorId: data.author_id,
      authorName: data.author_name,
      createdAt: data.created_at,
    }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
