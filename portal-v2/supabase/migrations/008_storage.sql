-- ============================================================
-- Migration 008: Storage Buckets
-- ============================================================

-- Campaign assets (concept decks, shot lists, contracts, invoices, deliverables)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('campaign-assets', 'campaign-assets', true, 52428800)  -- 50MB limit
ON CONFLICT (id) DO UPDATE SET file_size_limit = 52428800;

-- PO signatures (private — vendor drawn signatures)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('signatures', 'signatures', false, 5242880)  -- 5MB limit
ON CONFLICT (id) DO NOTHING;

-- Gear item photos
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('gear-images', 'gear-images', true, 10485760)  -- 10MB limit
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
-- campaign-assets: authenticated users can read, upload requires auth
CREATE POLICY "campaign_assets_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'campaign-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "campaign_assets_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'campaign-assets' AND auth.uid() IS NOT NULL);

-- signatures: only relevant users can read
CREATE POLICY "signatures_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'signatures' AND auth.uid() IS NOT NULL);

CREATE POLICY "signatures_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'signatures' AND auth.uid() IS NOT NULL);

-- gear-images: internal team only
CREATE POLICY "gear_images_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'gear-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "gear_images_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'gear-images' AND auth.uid() IS NOT NULL);
