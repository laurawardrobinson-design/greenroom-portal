import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; adviceId: string }> }
) {
  try {
    const user = await getAuthUser();
    const { adviceId } = await params;
    const supabase = createAdminClient();

    // Authors can delete their own advice, Admins can delete any
    if (user.role === "Admin") {
      const { error } = await supabase
        .from("goal_advice")
        .delete()
        .eq("id", adviceId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("goal_advice")
        .delete()
        .eq("id", adviceId)
        .eq("author_id", user.id);
      if (error) throw error;
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
