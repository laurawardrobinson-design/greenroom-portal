import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listUsers, createUser, updateUser } from "@/lib/services/crew.service";

// GET /api/users?roles=Admin,Producer,Studio
export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Designer", "Studio"]);
    const { searchParams } = new URL(request.url);
    const rolesParam = searchParams.get("roles");
    const roles = rolesParam ? rolesParam.split(",") : undefined;
    const users = await listUsers({ roles, active: true });
    return NextResponse.json(users);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/users — create a team member (contact-only, no auth account)
export async function POST(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const body = await request.json();
    const user = await createUser(body);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/users — update user fields (Admin or Producer)
export async function PATCH(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const updated = await updateUser(id, updates);
    return NextResponse.json(updated);
  } catch (error) {
    return authErrorResponse(error);
  }
}
