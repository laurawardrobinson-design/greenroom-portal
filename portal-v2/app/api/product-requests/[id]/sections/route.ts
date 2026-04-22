import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { upsertSection, deleteSection } from "@/lib/services/product-requests.service";
import type { PRDepartment } from "@/types/domain";

// POST /api/product-requests/[id]/sections — upsert a department section
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthUser();
    const { id } = await params;
    const body = (await request.json()) as {
      department?: PRDepartment;
      dateNeeded?: string | null;
      timeNeeded?: string;
      pickupPerson?: string;
    };
    if (!body.department) return NextResponse.json({ error: "department required" }, { status: 400 });

    const section = await upsertSection(id, body.department, {
      dateNeeded: body.dateNeeded,
      timeNeeded: body.timeNeeded,
      pickupPerson: body.pickupPerson,
    });
    return NextResponse.json(section);
  } catch (error) {
    return authErrorResponse(error);
  }
}
