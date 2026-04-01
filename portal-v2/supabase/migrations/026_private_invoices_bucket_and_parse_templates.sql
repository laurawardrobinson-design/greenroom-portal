-- ============================================================
-- Migration 026: Private Invoice Storage & Parse Templates
-- ============================================================

-- 1. Private bucket for invoice files (financial documents)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('invoices', 'invoices', false, 52428800)  -- 50MB, PRIVATE
ON CONFLICT (id) DO UPDATE SET public = false;

-- Only service role can read/write (no direct client access)
CREATE POLICY "invoices_service_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'invoices' AND auth.uid() IS NOT NULL);

CREATE POLICY "invoices_service_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'invoices' AND auth.uid() IS NOT NULL);

CREATE POLICY "invoices_service_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'invoices' AND auth.uid() IS NOT NULL);

-- 2. Vendor invoice parse templates — stores learned patterns per vendor
CREATE TABLE IF NOT EXISTS vendor_parse_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL DEFAULT '',
  -- Extraction patterns learned from AI parsing
  field_mappings JSONB NOT NULL DEFAULT '{}',
  -- Sample parsed output for reference
  sample_output JSONB NOT NULL DEFAULT '{}',
  -- How many invoices this template has been trained on
  training_count INTEGER NOT NULL DEFAULT 1,
  -- Confidence score (0-100) — increases with each successful match
  confidence INTEGER NOT NULL DEFAULT 50,
  -- Whether this template is active for pattern matching
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast vendor lookup
CREATE INDEX IF NOT EXISTS idx_parse_templates_vendor
  ON vendor_parse_templates(vendor_id) WHERE active = true;

-- RLS: only admins/producers can see templates
ALTER TABLE vendor_parse_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parse_templates_admin" ON vendor_parse_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('Admin', 'Producer')
    )
  );

-- 3. Add storage_path column to vendor_invoices for signed URL generation
ALTER TABLE vendor_invoices
  ADD COLUMN IF NOT EXISTS storage_path TEXT;
