-- Seed demo estimate view URLs for Holiday Promotion 2026 vendors.
-- These point to the rendered estimate page at /estimates/[campaignVendorId],
-- matching the same pattern used by invoice PDFs at /invoices/[campaignVendorId].

UPDATE public.campaign_vendors
SET
  estimate_file_url  = '/estimates/9dbd983e-6d28-426a-b063-181e308a84ac',
  estimate_file_name = 'Estimate-SetDressingPro-WF210601.pdf'
WHERE id = '9dbd983e-6d28-426a-b063-181e308a84ac';

UPDATE public.campaign_vendors
SET
  estimate_file_url  = '/estimates/d1457ebc-0bb9-494f-9eea-f7db904b7640',
  estimate_file_name = 'Estimate-SarahChenPhoto-WF210601.pdf'
WHERE id = 'd1457ebc-0bb9-494f-9eea-f7db904b7640';

UPDATE public.campaign_vendors
SET
  estimate_file_url  = '/estimates/2c484ae5-7713-4fb1-9187-e216d29d6c85',
  estimate_file_name = 'Estimate-PostProductionMasters-WF210601.pdf'
WHERE id = '2c484ae5-7713-4fb1-9187-e216d29d6c85';
