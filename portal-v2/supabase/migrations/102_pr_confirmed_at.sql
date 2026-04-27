-- Add confirmed_at timestamp to product_request_docs
-- Supports the new "confirmed" status in the BMM → RBU workflow
ALTER TABLE product_request_docs ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
