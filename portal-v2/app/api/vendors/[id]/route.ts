import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { updateVendor } from "@/lib/services/vendors.service";
import { updateVendorSchema } from "@/lib/validation/vendors.schema";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer"]);
    const { id } = await params;
    const body = await req.json();
    const parsed = updateVendorSchema.parse(body);
    const vendor = await updateVendor(id, parsed);
    return NextResponse.json(vendor);
  } catch (error) {
    return authErrorResponse(error);
  }
}
