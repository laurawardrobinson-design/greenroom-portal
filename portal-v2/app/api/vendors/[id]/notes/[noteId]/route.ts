import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (user.role === "Vendor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { noteId } = await params;
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("vendor_praise_notes")
      .delete()
      .eq("id", noteId)
      .eq("author_id", user.id);
    if (error) throw error;
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
