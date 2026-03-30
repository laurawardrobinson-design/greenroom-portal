import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CreatureKey } from "@/lib/constants/menagerie";

const VALID_CREATURES = new Set<string>(["gator", "peacock", "moth", "raccoon"]);

// GET /api/menagerie — return current user's discovered creatures
export async function GET() {
  try {
    const user = await getAuthUser();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("menagerie_collections")
      .select("creature_key, discovered_at")
      .eq("user_id", user.id)
      .order("discovered_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/menagerie — discover a creature
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    const body = await request.json();
    const creatureKey = body.creatureKey as CreatureKey;

    if (!creatureKey || !VALID_CREATURES.has(creatureKey)) {
      return NextResponse.json({ error: "Invalid creature" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { error } = await supabase
      .from("menagerie_collections")
      .upsert(
        {
          user_id: user.id,
          creature_key: creatureKey,
        },
        { onConflict: "user_id,creature_key", ignoreDuplicates: true }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ discovered: creatureKey });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/menagerie — zookeeper rehomes all creatures
export async function DELETE() {
  try {
    const user = await getAuthUser();
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("menagerie_collections")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reset: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
