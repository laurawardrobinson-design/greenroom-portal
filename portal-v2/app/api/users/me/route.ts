import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { updateUser } from "@/lib/services/crew.service";

// PATCH /api/users/me — self-service profile update (any authenticated user)
export async function PATCH(request: Request) {
  try {
    const user = await getAuthUser();
    const body = await request.json();

    // Whitelist of fields a user can update on their own profile
    const allowed = [
      "name",
      "phone",
      "title",
      "favoriteDrinks",
      "favoriteSnacks",
      "energyBoost",
      "dietaryRestrictions",
      "allergies",
      "favoritePublixProduct",
      "lunchPlace",
      "preferredContact",
      "onboardingCompleted",
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const updated = await updateUser(user.id, updates);
    return NextResponse.json(updated);
  } catch (error) {
    return authErrorResponse(error);
  }
}
