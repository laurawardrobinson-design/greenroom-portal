import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Studio"]);
    const { id } = await params;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: "Only JPG, PNG, and WebP images are allowed" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be under 10 MB" }, { status: 400 });
    }

    const db = createAdminClient();
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `job-classes/${id}/${timestamp}-${safeName}`;

    const buffer = await file.arrayBuffer();

    const { error: uploadError } = await db.storage
      .from("wardrobe-images")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = db.storage
      .from("wardrobe-images")
      .getPublicUrl(storagePath);

    const { error: updateError } = await db
      .from("job_classes")
      .update({ image_url: urlData.publicUrl })
      .eq("id", id);

    if (updateError) throw updateError;

    return NextResponse.json({ imageUrl: urlData.publicUrl });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Studio"]);
    const { id } = await params;
    const db = createAdminClient();

    const { error } = await db
      .from("job_classes")
      .update({ image_url: null })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
