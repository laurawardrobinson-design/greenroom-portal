import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  getCrewBooking,
  updateCrewBooking,
  deleteCrewBooking,
  confirmBookingDates,
} from "@/lib/services/crew-bookings.service";
import { createCrewPayment } from "@/lib/services/crew-payments.service";

// GET /api/crew-bookings/[id]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthUser();
    const { id } = await params;
    const booking = await getCrewBooking(id);

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    return NextResponse.json(booking);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/crew-bookings/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    const body = await request.json();

    // Action: confirm days worked (and optionally submit for payment)
    if (body.action === "confirm_days") {
      await requireRole(["Admin", "Producer"]);
      const booking = await confirmBookingDates(
        id,
        body.confirmations,
        user.id
      );

      // If submitPayment flag is set, create a crew_payment record and mark booking Completed
      if (body.submitPayment === true) {
        const confirmedCount = (body.confirmations as Array<{ confirmed: boolean }>).filter(
          (c) => c.confirmed
        ).length;
        const totalAmount = confirmedCount * booking.dayRate;

        if (confirmedCount > 0) {
          await createCrewPayment({
            bookingId: id,
            totalDays: confirmedCount,
            totalAmount,
            confirmedBy: user.id,
            notes: body.paymentNotes || "",
          });
          // Mark booking as Completed
          await updateCrewBooking(id, { status: "Completed" });
        }
      }

      // Re-fetch to include payment
      const updated = await getCrewBooking(id);
      return NextResponse.json(updated);
    }

    // Action: approve booking (HOP only)
    if (body.action === "approve") {
      await requireRole(["Admin"]);
      const booking = await updateCrewBooking(id, {
        status: "Confirmed",
        approvedBy: user.id,
      });
      return NextResponse.json(booking);
    }

    // Action: cancel booking
    if (body.action === "cancel") {
      await requireRole(["Admin", "Producer"]);
      const booking = await updateCrewBooking(id, { status: "Cancelled" });
      return NextResponse.json(booking);
    }

    // Action: mark completed
    if (body.action === "complete") {
      await requireRole(["Admin", "Producer"]);
      const booking = await updateCrewBooking(id, { status: "Completed" });
      return NextResponse.json(booking);
    }

    // General update (role, rate, notes, classification)
    await requireRole(["Admin", "Producer"]);
    const booking = await updateCrewBooking(id, {
      role: body.role,
      dayRate: body.dayRate !== undefined ? Number(body.dayRate) : undefined,
      classification: body.classification,
      notes: body.notes,
    });

    return NextResponse.json(booking);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/crew-bookings/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer"]);
    const { id } = await params;
    await deleteCrewBooking(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
