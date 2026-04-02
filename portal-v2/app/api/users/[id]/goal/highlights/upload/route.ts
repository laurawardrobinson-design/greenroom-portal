import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;

    // Only the goal owner can upload files
    if (user.id !== id) {
      return NextResponse.json({ error: "Only the goal owner can upload files" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Upload to Supabase Storage
    const ext = file.name.split(".").pop() || "bin";
    const storagePath = `${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("goal-files")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Get public URL (bucket is private, but we use signed URLs or admin access)
    const { data: urlData } = supabase.storage
      .from("goal-files")
      .getPublicUrl(storagePath);

    // Create a file record (highlight_id will be linked later when highlight is submitted)
    const { data: fileRecord, error: dbError } = await supabase
      .from("goal_highlight_files")
      .insert({
        highlight_id: null as unknown as string, // Will be linked when highlight is created
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
      })
      .select("id, file_url, file_name, file_size, file_type, created_at")
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({
      id: fileRecord.id,
      fileUrl: fileRecord.file_url,
      fileName: fileRecord.file_name,
      fileSize: fileRecord.file_size,
      fileType: fileRecord.file_type,
      createdAt: fileRecord.created_at,
    }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
