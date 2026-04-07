-- Seed a demo PO for Post Production Masters (Holiday Promotion 2026).
-- Advances status to "PO Uploaded" with a generated PO number and the
-- rendered PO page URL — ready to be signed by the vendor.

UPDATE public.campaign_vendors
SET
  po_number    = 'PO-WF210601',
  po_file_url  = '/po/2c484ae5-7713-4fb1-9187-e216d29d6c85',
  status       = 'PO Uploaded'
WHERE id = '2c484ae5-7713-4fb1-9187-e216d29d6c85';
