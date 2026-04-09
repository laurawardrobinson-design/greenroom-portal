-- Add signature and PO number field placement coordinates to campaign_vendors.
-- Both are stored as percentages (0–100) of the PO document's reference frame
-- so placement made in the SendPoModal preview translates to the final PO page.
-- Defaults place the signature near the bottom-left and the PO# at the top-right.

ALTER TABLE campaign_vendors
  ADD COLUMN IF NOT EXISTS signature_field_x numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS signature_field_y numeric DEFAULT 76,
  ADD COLUMN IF NOT EXISTS po_number_field_x  numeric DEFAULT 62,
  ADD COLUMN IF NOT EXISTS po_number_field_y  numeric DEFAULT 8;
