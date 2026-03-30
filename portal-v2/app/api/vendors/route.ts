import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listVendors, createVendor } from "@/lib/services/vendors.service";
import { createVendorSchema } from "@/lib/validation/vendors.schema";

export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer"]);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const category = searchParams.get("category") || undefined;

    const vendors = await listVendors({ search, category, active: true });
    return NextResponse.json(vendors);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(["Admin", "Producer"]);
    const body = await request.json();
    const parsed = createVendorSchema.parse(body);
    const vendor = await createVendor(parsed);
    return NextResponse.json(vendor, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: error }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
