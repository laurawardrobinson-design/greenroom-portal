-- Migration 045: Add estimate file URL fields and signed PO field to campaign_vendors
--
-- estimate_file_url / estimate_file_name: stores the PDF a vendor uploads when submitting
--   a PDF-style estimate (previously only the filename was stored in vendor_estimate_items.description)
-- po_signed_file_url: stores the signed PO PDF once the vendor returns a countersigned copy

ALTER TABLE public.campaign_vendors
  ADD COLUMN IF NOT EXISTS estimate_file_url   text,
  ADD COLUMN IF NOT EXISTS estimate_file_name  text,
  ADD COLUMN IF NOT EXISTS po_signed_file_url  text;
