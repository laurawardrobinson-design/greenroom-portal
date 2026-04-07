-- Update demo invoice file_urls to use a publicly accessible sample PDF.
-- These are placeholder URLs for demo/testing purposes only.
-- In production, all files are served from private Supabase Storage via signed URLs.

UPDATE public.vendor_invoices
SET file_url = 'https://filesamples.com/samples/document/pdf/sample3.pdf'
WHERE id IN (
  'inv00000-0000-0000-0000-000000000001'::uuid,
  'inv00000-0000-0000-0000-000000000002'::uuid,
  'inv00000-0000-0000-0000-000000000003'::uuid,
  'inv00000-0000-0000-0000-000000000004'::uuid
);
