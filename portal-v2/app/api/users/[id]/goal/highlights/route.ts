import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGoalViewer, getGoalId, touchGoalActivity } from "@/lib/services/goals.service";
import { notifyGoalStakeholders } from "@/lib/services/notifications.service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (user.role === "Vendor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;

    const canView = await isGoalViewer(id, user.id);
    if (!canView) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const goalId = await getGoalId(id);
    if (!goalId) return NextResponse.json([]);

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("goal_highlights")
      .select("*, goal_highlight_files(*), goal_highlight_feedback(*)")
      .eq("goal_id", goalId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const mapped = (data ?? []).map((h) => ({
      id: h.id,
      goalId: h.goal_id,
      text: h.text,
      links: h.links || [],
      createdAt: h.created_at,
      files: ((h.goal_highlight_files as Array<Record<string, unknown>>) || []).map((f) => ({
        id: f.id as string,
        highlightId: f.highlight_id as string,
        fileUrl: f.file_url as string,
        fileName: f.file_name as string,
        fileSize: f.file_size as number,
        fileType: f.file_type as string,
        createdAt: f.created_at as string,
      })),
      feedback: ((h.goal_highlight_feedback as Array<Record<string, unknown>>) || [])
        .sort((a, b) => (a.created_at as string).localeCompare(b.created_at as string))
        .map((f) => ({
          id: f.id as string,
          highlightId: f.highlight_id as string,
          text: f.text as string,
          authorId: f.author_id as string,
          authorName: f.author_name as string,
          createdAt: f.created_at as string,
        })),
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
    if (user.role === "Vendor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;

    // Only the goal owner can post highlights
    if (user.id !== id) {
      return NextResponse.json({ error: "Only the goal owner can post highlights" }, { status: 403 });
    }

    const goalId = await getGoalId(id);
    if (!goalId) {
      return NextResponse.json({ error: "No goal found" }, { status: 404 });
    }

    const { text, links, fileIds } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("goal_highlights")
      .insert({
        goal_id: goalId,
        text: text.trim(),
        links: (links || []).filter((l: string) => l.trim()),
      })
      .select("*")
      .single();

    if (error) throw error;

    // Link uploaded files to this highlight
    if (fileIds?.length) {
      await supabase
        .from("goal_highlight_files")
        .update({ highlight_id: data.id })
        .in("id", fileIds);
    }

    await touchGoalActivity(goalId);

    // Notify stakeholders
    await notifyGoalStakeholders(goalId, user.id, {
      type: "goal_highlight",
      title: `${user.name} shared a growth update`,
      body: text.trim().substring(0, 200),
    });

    return NextResponse.json({
      id: data.id,
      goalId: data.goal_id,
      text: data.text,
      links: data.links || [],
      createdAt: data.created_at,
    }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
