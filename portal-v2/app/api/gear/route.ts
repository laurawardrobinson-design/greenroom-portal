import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listGearItems, createGearItem, checkoutGear, checkinGear, getGearItemByQr, getGearItemByRfid, getActiveCheckouts, batchCheckoutGear, batchCheckinGear, updateGearItem } from "@/lib/services/gear.service";
import type { GearCategory, GearCondition } from "@/types/domain";
import { createAdminClient } from "@/lib/supabase/admin";

// DELETE /api/gear?id=xxx — soft-delete (retire) a gear item
export async function DELETE(request: Request) {
  try {
    await requireRole(["Admin", "Studio"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const db = createAdminClient();
    const { error } = await db
      .from("gear_items")
      .update({ status: "Retired" })
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Studio"]);
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as GearCategory | null;
    const status = searchParams.get("status") as string | null;
    const search = searchParams.get("search") || undefined;
    const section = (searchParams.get("section") as "Gear" | "Props") || "Gear";
    const qrCode = searchParams.get("qr");
    const rfidTag = searchParams.get("rfid");

    if (qrCode) {
      const item = await getGearItemByQr(qrCode);
      return NextResponse.json(item);
    }

    if (rfidTag) {
      const item = await getGearItemByRfid(rfidTag);
      return NextResponse.json(item);
    }

    const items = await listGearItems({
      category: category || undefined,
      status: status as never || undefined,
      search,
      section,
    });
    return NextResponse.json(items);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Studio"]);
    const body = await request.json();

    if (body.action === "checkout") {
      const checkoutId = await checkoutGear({
        gearItemId: body.gearItemId,
        userId: user.id,
        campaignId: body.campaignId,
        condition: body.condition as GearCondition || "Good",
        notes: body.notes,
      });
      return NextResponse.json({ checkoutId });
    }

    if (body.action === "checkin") {
      await checkinGear({
        checkoutId: body.checkoutId,
        condition: body.condition as GearCondition || "Good",
        notes: body.notes,
      });
      return NextResponse.json({ success: true });
    }

    // Check in by item ID (finds the active checkout automatically)
    if (body.action === "checkin_by_item") {
      const checkouts = await getActiveCheckouts();
      const active = checkouts.find((c) => c.gearItemId === body.gearItemId);
      if (!active) {
        return NextResponse.json({ error: "No active checkout for this item" }, { status: 400 });
      }
      await checkinGear({
        checkoutId: active.id,
        condition: body.condition as GearCondition || "Good",
        notes: body.notes,
      });
      return NextResponse.json({ success: true });
    }

    // Batch checkout
    if (body.action === "batch_checkout") {
      const results = await batchCheckoutGear(
        body.items || [],
        user.id,
        body.campaignId
      );
      return NextResponse.json({ results });
    }

    // Batch checkin
    if (body.action === "batch_checkin") {
      const results = await batchCheckinGear(
        body.gearItemIds || [],
        body.condition as GearCondition || "Good"
      );
      return NextResponse.json({ results });
    }

    // Assign RFID tag to a gear item
    if (body.action === "assign_rfid" && body.id) {
      const updated = await updateGearItem(body.id, { rfidTag: body.rfidTag ?? null });
      return NextResponse.json(updated);
    }

    // Update gear item
    if (body.action === "update" && body.id) {
      const updated = await updateGearItem(body.id, {
        name: body.name,
        category: body.category,
        brand: body.brand,
        model: body.model,
        serialNumber: body.serialNumber,
        condition: body.condition,
        notes: body.notes,
        imageUrl: body.imageUrl,
      });
      return NextResponse.json(updated);
    }

    // Create gear item (body.section defaults to 'Gear' in the service)
    const item = await createGearItem(body);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
