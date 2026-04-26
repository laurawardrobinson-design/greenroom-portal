import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; stakeholderId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (user.role === "Vendor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (user.role !== "Admin") {
      return NextResponse.json({ error: "Only Admin can remove stakeholders" }, { status: 403 });
    }

    const { stakeholderId } = await params;
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("goal_stakeholders")
      .delete()
      .eq("id", stakeholderId);

    if (error) throw error;
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
