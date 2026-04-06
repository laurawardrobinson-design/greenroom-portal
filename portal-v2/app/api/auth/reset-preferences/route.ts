import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Dev-only: resets user preferences and onboarding status for ALL users
// Allows all users to redo onboarding flow
// Only works when NEXT_PUBLIC_DEV_AUTH=true

export async function POST(request: Request) {
  const allowed =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_RESET_ENABLED === "true";

  if (!allowed) {
    return NextResponse.json({ error: "Reset not enabled" }, { status: 403 });
  }

  const admin = createAdminClient();

  try {
    // Reset preferences only for Gretchen and Laura (demo test accounts)
    const { error } = await admin
      .from("users")
      .update({
        onboarding_completed: false,
        favorite_publix_product: "",
        favorite_snacks: "",
        favorite_drinks: "",
        dietary_restrictions: "",
        allergies: "",
        energy_boost: "",
        lunch_place: "",
        preferred_contact: "Email",
      })
      .in("email", ["admin@test.local", "producer@test.local"]);

    if (error) {
      console.error("Reset preferences error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to reset preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Gretchen & Laura preferences reset! They will see onboarding on next login.",
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
