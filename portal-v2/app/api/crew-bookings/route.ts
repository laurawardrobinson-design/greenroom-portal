import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listCrewBookings,
  createCrewBooking,
} from "@/lib/services/crew-bookings.service";

// GET /api/crew-bookings?campaignId=xxx
export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");

    if (!campaignId) {
      return NextResponse.json(
        { error: "campaignId is required" },
        { status: 400 }
      );
    }

    const bookings = await listCrewBookings(campaignId);

    // Filter for vendors — they can only see their own bookings
    if (user.role === "Vendor") {
      const filtered = bookings.filter((b) => b.vendorId === user.vendorId);
      return NextResponse.json(filtered);
    }

    return NextResponse.json(bookings);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/crew-bookings
export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer"]);
    const body = await request.json();

    const { campaignId, vendorId, userId, role, dayRate, classification, dates, notes } = body;

    if (!campaignId || !role || !dayRate || !dates?.length) {
      return NextResponse.json(
        { error: "campaignId, role, dayRate, and dates are required" },
        { status: 400 }
      );
    }

    if (!vendorId && !userId) {
      return NextResponse.json(
        { error: "Either vendorId or userId is required" },
        { status: 400 }
      );
    }

    const booking = await createCrewBooking({
      campaignId,
      vendorId,
      userId,
      role,
      dayRate: Number(dayRate),
      classification,
      dates,
      bookedBy: user.id,
      notes,
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
