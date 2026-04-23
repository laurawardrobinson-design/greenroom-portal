import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse, AuthError } from "@/lib/auth/guards";
import { upsertSection } from "@/lib/services/product-requests.service";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PRDepartment } from "@/types/domain";

// POST /api/product-requests/[id]/sections — upsert a department section
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    const body = (await request.json()) as {
      department?: PRDepartment;
      dateNeeded?: string | null;
      timeNeeded?: string;
      pickupPerson?: string;
      pickupPhone?: string;
    };
    if (!body.department) return NextResponse.json({ error: "department required" }, { status: 400 });

    // Pickup person + phone are producer-owned fields. BMM / Studio
    // must never be able to modify them, even on submitted docs.
    const wantsPickupEdit =
      body.pickupPerson !== undefined || body.pickupPhone !== undefined;
    if (wantsPickupEdit) {
      if (
        user.role !== "Producer" &&
        user.role !== "Post Producer" &&
        user.role !== "Admin"
      ) {
        throw new AuthError("Only the producer can edit pickup contact", 403);
      }

      // Also require the doc to still be a draft.
      const db = createAdminClient();
      const { data: doc } = await db
        .from("product_request_docs")
        .select("status, submitted_by")
        .eq("id", id)
        .single();
      if (!doc) throw new AuthError("PR not found", 404);
      if ((doc as { status: string }).status !== "draft") {
        throw new AuthError("Pickup contact is locked after submission", 403);
      }
    }

    const section = await upsertSection(id, body.department, {
      dateNeeded: body.dateNeeded,
      timeNeeded: body.timeNeeded,
      pickupPerson: body.pickupPerson,
      pickupPhone: body.pickupPhone,
    });
    return NextResponse.json(section);
  } catch (error) {
    return authErrorResponse(error);
  }
}
