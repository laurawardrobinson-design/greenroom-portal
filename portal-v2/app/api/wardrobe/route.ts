import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listWardrobeItems,
  createWardrobeItem,
  getWardrobeItemByQr,
  checkoutWardrobeItem,
  checkinWardrobeItem,
  checkinWardrobeItemByItemId,
  batchCheckoutWardrobe,
  batchCheckinWardrobe,
} from "@/lib/services/wardrobe.service";
import { createWardrobeSchema } from "@/lib/validation/wardrobe.schema";
import type { WardrobeCategory, WardrobeCondition } from "@/types/domain";

export async function GET(request: Request) {
  try {
    await getAuthUser();
    const { searchParams } = new URL(request.url);

    // QR code lookup
    const qr = searchParams.get("qr");
    if (qr) {
      const item = await getWardrobeItemByQr(qr.trim());
      if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
      return NextResponse.json(item);
    }

    const category = searchParams.get("category") as WardrobeCategory | null;
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;

    const items = await listWardrobeItems({ category: category || undefined, search, status });
    return NextResponse.json(items);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Art Director", "Studio"]);
    const body = await request.json();
    const { action } = body;

    // ── Checkout actions ──────────────────────────────────────────────────────
    if (action === "checkout") {
      const checkoutId = await checkoutWardrobeItem({
        wardrobeItemId: body.wardrobeItemId,
        userId: user.id,
        campaignId: body.campaignId,
        condition: body.condition as WardrobeCondition,
        notes: body.notes,
        dueDate: body.dueDate,
      });
      return NextResponse.json({ checkoutId });
    }

    if (action === "checkin") {
      await checkinWardrobeItem({
        checkoutId: body.checkoutId,
        condition: body.condition as WardrobeCondition,
        notes: body.notes,
      });
      return NextResponse.json({ success: true });
    }

    if (action === "checkin_by_item") {
      await checkinWardrobeItemByItemId({
        wardrobeItemId: body.wardrobeItemId,
        condition: body.condition as WardrobeCondition,
        notes: body.notes,
      });
      return NextResponse.json({ success: true });
    }

    if (action === "batch_checkout") {
      const results = await batchCheckoutWardrobe(
        body.items,
        user.id,
        body.campaignId,
        body.dueDate
      );
      return NextResponse.json({ results });
    }

    if (action === "batch_checkin") {
      const results = await batchCheckinWardrobe(
        body.wardrobeItemIds,
        body.condition as WardrobeCondition
      );
      return NextResponse.json({ results });
    }

    // ── Create item ───────────────────────────────────────────────────────────
    const parsed = createWardrobeSchema.parse(body);
    const item = await createWardrobeItem(parsed, user.id);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
