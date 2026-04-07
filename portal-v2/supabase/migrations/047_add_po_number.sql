-- Add po_number column to campaign_vendors for generated PO documents.
-- When a producer clicks "Generate PO", a PO number is assigned and stored here.

ALTER TABLE public.campaign_vendors
  ADD COLUMN IF NOT EXISTS po_number text;
