ALTER TABLE campaign_vendors
  ADD COLUMN IF NOT EXISTS po_authorized_by  text,
  ADD COLUMN IF NOT EXISTS po_authorized_at  timestamptz;
