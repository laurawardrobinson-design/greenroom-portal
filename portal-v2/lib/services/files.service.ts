import { createAdminClient } from "@/lib/supabase/admin";
import type { CampaignAsset, AssetCategory } from "@/types/domain";
import { FUN_DOCUMENT_CATEGORIES, BORING_DOCUMENT_CATEGORIES } from "@/types/domain";

function toAsset(row: Record<string, unknown>): CampaignAsset {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    uploadedBy: row.uploaded_by as string,
    vendorId: (row.vendor_id as string) || null,
    fileUrl: row.file_url as string,
    fileName: row.file_name as string,
    fileSize: Number(row.file_size) || 0,
    fileType: row.file_type as string,
    category: row.category as AssetCategory,
    createdAt: row.created_at as string,
  };
}

export async function listCampaignAssets(
  campaignId: string,
  type?: "fun" | "boring"
): Promise<CampaignAsset[]> {
  const db = createAdminClient();
  let query = db
    .from("campaign_assets")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (type === "fun") {
    query = query.in("category", FUN_DOCUMENT_CATEGORIES);
  } else if (type === "boring") {
    query = query.in("category", BORING_DOCUMENT_CATEGORIES);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(toAsset);
}

export async function uploadCampaignAsset(input: {
  campaignId: string;
  uploadedBy: string;
  vendorId?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  category: AssetCategory;
  fileBuffer: ArrayBuffer;
}): Promise<CampaignAsset> {
  const db = createAdminClient();
  const timestamp = Date.now();
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `campaigns/${input.campaignId}/${timestamp}-${safeName}`;

  // Log suspicious uploads (images as Reference)
  if (/^image\//.test(input.fileType) && input.category === "Reference") {
    console.warn(`[WARNING] Image uploaded as Reference category: ${input.fileName} (${input.fileType}) by user ${input.uploadedBy}`);
  }

  // Upload to storage
  const { error: uploadError } = await db.storage
    .from("campaign-assets")
    .upload(storagePath, input.fileBuffer, {
      contentType: input.fileType,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: urlData } = db.storage
    .from("campaign-assets")
    .getPublicUrl(storagePath);

  // Create asset record
  const { data, error } = await db
    .from("campaign_assets")
    .insert({
      campaign_id: input.campaignId,
      uploaded_by: input.uploadedBy,
      vendor_id: input.vendorId || null,
      file_url: urlData.publicUrl,
      file_name: input.fileName,
      file_size: input.fileSize,
      file_type: input.fileType,
      category: input.category,
    })
    .select()
    .single();

  if (error) throw error;
  return toAsset(data);
}

export async function deleteAsset(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("campaign_assets").delete().eq("id", id);
  if (error) throw error;
}
