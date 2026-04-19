import { NextResponse } from "next/server";
import { ZodError } from "zod";
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
import {
  createWardrobeSchema,
  checkoutActionSchema,
  checkinActionSchema,
  checkinByItemActionSchema,
  batchCheckoutActionSchema,
  batchCheckinActionSchema,
} from "@/lib/validation/wardrobe.schema";
import type { WardrobeCategory } from "@/types/domain";

function zodErrorResponse(error: ZodError) {
  const fieldErrors = error.issues.reduce((acc: Record<string, string>, err) => {
    const path = err.path.join(".") || "unknown";
    acc[path] = err.message;
    return acc;
  }, {});
  return NextResponse.json({ error: "Validation failed", fieldErrors }, { status: 400 });
}

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
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Studio"]);
    const body = await request.json();
    const { action } = body;

    // ── Checkout actions ──────────────────────────────────────────────────────
    if (action === "checkout") {
      const parsed = checkoutActionSchema.parse(body);
      const checkoutId = await checkoutWardrobeItem({
        wardrobeItemId: parsed.wardrobeItemId,
        userId: user.id,
        campaignId: parsed.campaignId,
        condition: parsed.condition,
        notes: parsed.notes,
        dueDate: parsed.dueDate,
      });
      return NextResponse.json({ checkoutId });
    }

    if (action === "checkin") {
      const parsed = checkinActionSchema.parse(body);
      await checkinWardrobeItem({
        checkoutId: parsed.checkoutId,
        condition: parsed.condition ?? "Good",
        notes: parsed.notes,
      });
      return NextResponse.json({ success: true });
    }

    if (action === "checkin_by_item") {
      const parsed = checkinByItemActionSchema.parse(body);
      await checkinWardrobeItemByItemId({
        wardrobeItemId: parsed.wardrobeItemId,
        condition: parsed.condition ?? "Good",
        notes: parsed.notes,
      });
      return NextResponse.json({ success: true });
    }

    if (action === "batch_checkout") {
      const parsed = batchCheckoutActionSchema.parse(body);
      const results = await batchCheckoutWardrobe(
        parsed.items,
        user.id,
        parsed.campaignId,
        parsed.dueDate
      );
      return NextResponse.json({ results });
    }

    if (action === "batch_checkin") {
      const parsed = batchCheckinActionSchema.parse(body);
      const results = await batchCheckinWardrobe(
        parsed.wardrobeItemIds,
        parsed.condition ?? "Good"
      );
      return NextResponse.json({ results });
    }

    // ── Create item ───────────────────────────────────────────────────────────
    const parsed = createWardrobeSchema.parse(body);
    const item = await createWardrobeItem(parsed, user.id);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return zodErrorResponse(error);
    return authErrorResponse(error);
  }
}
