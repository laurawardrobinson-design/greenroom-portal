-- ============================================================
-- Migration 064: Job Class Image
-- ============================================================

-- Add image_url column to job_classes
ALTER TABLE job_classes ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create wardrobe-images storage bucket (public for serving)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('wardrobe-images', 'wardrobe-images', true, 10485760)  -- 10MB limit
ON CONFLICT (id) DO NOTHING;

-- RLS policies for wardrobe-images
CREATE POLICY "wardrobe_images_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'wardrobe-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "wardrobe_images_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'wardrobe-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "wardrobe_images_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'wardrobe-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "wardrobe_images_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'wardrobe-images' AND auth.uid() IS NOT NULL);
