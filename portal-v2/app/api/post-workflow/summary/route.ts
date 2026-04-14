import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { getPostWorkflowSummary } from "@/lib/services/post-workflow.service";

export async function GET() {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const summary = await getPostWorkflowSummary();
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
