import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listAttachments,
  uploadAttachment,
} from "@/lib/services/call-sheet.service";
import type { CallSheetAttachmentKind } from "@/types/domain";

const ALLOWED_KINDS: CallSheetAttachmentKind[] = [
  "talent_release",
  "minor_release",
  "location_permit",
  "coi",
  "safety_bulletin",
  "other",
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Art Director",
      "Studio",
      "Creative Director",
      "Designer",
      "Brand Marketing Manager",
    ]);
    const { id } = await params;
    const attachments = await listAttachments(id);
    return NextResponse.json(attachments);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Art Director",
    ]);
    const { id } = await params;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const kindRaw = String(formData.get("kind") || "other");
    const label = String(formData.get("label") || "");
    const expiresAt = formData.get("expiresAt")
      ? String(formData.get("expiresAt"))
      : null;
    const required = formData.get("required") === "true";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const kind: CallSheetAttachmentKind = ALLOWED_KINDS.includes(
      kindRaw as CallSheetAttachmentKind
    )
      ? (kindRaw as CallSheetAttachmentKind)
      : "other";

    const attachment = await uploadAttachment(id, file, {
      kind,
      label,
      expiresAt,
      required,
      uploadedBy: user.id,
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
