import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Dev-only: resets user preferences and onboarding status for ALL users
// Allows all users to redo onboarding flow
// Only works when NEXT_PUBLIC_DEV_AUTH=true

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DEV_AUTH !== "true") {
    return NextResponse.json({ error: "Dev auth disabled" }, { status: 403 });
  }

  const admin = createAdminClient();

  try {
    // Reset ALL user preferences and onboarding status
    // Filter by a condition that matches all records (active = true or false)
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
      .or("active.eq.true,active.eq.false");

    if (error) {
      console.error("Reset preferences error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to reset preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "All user preferences reset! Users will see onboarding on next login.",
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
