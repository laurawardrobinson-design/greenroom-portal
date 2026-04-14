import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listJobClassItems,
  addItemToJobClass,
  updateJobClassItem,
  removeItemFromJobClass,
} from "@/lib/services/job-classes.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthUser();
    const { id } = await params;
    const items = await listJobClassItems(id);
    return NextResponse.json(items);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Studio"]);
    const { id } = await params;
    const body = await request.json();

    if (body.action === "remove") {
      await removeItemFromJobClass(body.jobClassItemId);
      return NextResponse.json({ success: true });
    }

    if (body.action === "update_item") {
      const item = await updateJobClassItem(body.jobClassItemId, {
        notes: body.notes,
        gender: body.gender,
        optionGroup: body.optionGroup,
        required: body.required,
      });
      return NextResponse.json(item);
    }

    // Legacy action name kept for backward compat
    if (body.action === "update_notes") {
      const item = await updateJobClassItem(body.jobClassItemId, { notes: body.notes ?? "" });
      return NextResponse.json(item);
    }

    if (!body.wardrobeItemId) {
      return NextResponse.json({ error: "wardrobeItemId required" }, { status: 400 });
    }
    const item = await addItemToJobClass(id, body.wardrobeItemId, {
      notes: body.notes,
      gender: body.gender,
      optionGroup: body.optionGroup,
      required: body.required,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already in")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return authErrorResponse(error);
  }
}
