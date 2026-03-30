import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listKits, createKit, checkoutKit, updateKit, deleteKit } from "@/lib/services/gear.service";
import type { GearCondition } from "@/types/domain";

// GET /api/gear/kits
export async function GET() {
  try {
    await requireRole(["Admin", "Producer", "Studio"]);
    const kits = await listKits();
    return NextResponse.json(kits);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/gear/kits
export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Studio"]);
    const body = await request.json();
    // Kit checkout action
    if (body.action === "checkout_kit") {
      const result = await checkoutKit({
        kitId: body.kitId,
        userId: user.id,
        condition: (body.condition as GearCondition) || "Good",
        campaignId: body.campaignId,
      });
      return NextResponse.json(result);
    }

    const { name, description, itemIds, isFavorite } = body;

    if (!name || !itemIds?.length) {
      return NextResponse.json(
        { error: "name and at least one item are required" },
        { status: 400 }
      );
    }

    const kit = await createKit({
      name,
      description,
      createdBy: user.id,
      isFavorite,
      itemIds,
    });
    return NextResponse.json(kit, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/gear/kits?id=xxx
export async function PATCH(request: Request) {
  try {
    await requireRole(["Admin", "Studio"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const body = await request.json();
    await updateKit(id, {
      name: body.name,
      description: body.description,
      isFavorite: body.isFavorite,
      addItemIds: body.addItemIds,
      removeItemIds: body.removeItemIds,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/gear/kits?id=xxx
export async function DELETE(request: Request) {
  try {
    await requireRole(["Admin", "Studio"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await deleteKit(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
