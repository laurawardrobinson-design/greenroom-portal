import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listMeals,
  createMeal,
  updateMeal,
  deleteMeal,
} from "@/lib/services/studio.service";
import type { MealType, MealLocation, MealHandlerRole } from "@/types/domain";

export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Studio"]);
    const { searchParams } = new URL(request.url);
    const meals = await listMeals({
      campaignId:  searchParams.get("campaignId") ?? undefined,
      dateFrom:    searchParams.get("dateFrom") ?? undefined,
      dateTo:      searchParams.get("dateTo") ?? undefined,
      location:    (searchParams.get("location") as MealLocation) ?? undefined,
      handlerRole: (searchParams.get("handlerRole") as MealHandlerRole) ?? undefined,
    });
    return NextResponse.json(meals);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Studio"]);
    const body = await request.json();
    const { campaignId, shootDate, mealType, location, handlerRole, ...rest } = body;

    if (!campaignId || !shootDate || !mealType || !location || !handlerRole) {
      return NextResponse.json(
        { error: "campaignId, shootDate, mealType, location, and handlerRole are required" },
        { status: 400 }
      );
    }

    const meal = await createMeal({
      campaignId,
      shootDate,
      mealType: mealType as MealType,
      location: location as MealLocation,
      handlerRole: handlerRole as MealHandlerRole,
      handlerId: rest.handlerId ?? null,
      headcount: rest.headcount ?? null,
      dietaryNotes: rest.dietaryNotes ?? null,
      preferences: rest.preferences ?? null,
      vendor: rest.vendor ?? null,
      deliveryTime: rest.deliveryTime ?? null,
      notes: rest.notes ?? null,
      createdBy: user.id,
    });
    return NextResponse.json(meal, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Studio"]);
    const body = await request.json();
    const { id, ...patch } = body;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const meal = await updateMeal(id, patch);
    return NextResponse.json(meal);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Studio"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await deleteMeal(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
