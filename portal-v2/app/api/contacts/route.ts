import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { searchContacts } from "@/lib/services/contact-picker.service";

// GET /api/contacts?search=foo
// Unified search across internal users and external vendors.
// Used by the PR pickup-contact picker and similar contact fields.
export async function GET(request: Request) {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Brand Marketing Manager",
      "Studio",
      "Art Director",
      "Designer",
    ]);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const results = await searchContacts(search);
    return NextResponse.json(results);
  } catch (error) {
    return authErrorResponse(error);
  }
}
