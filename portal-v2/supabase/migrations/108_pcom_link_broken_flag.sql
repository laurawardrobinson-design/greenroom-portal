-- Migration 108: Track broken publix.com product links.
--
-- pcom_link points at a publix.com PDP. When Publix renames or retires a
-- product the link 404s. There is no reliable way to detect this from the
-- browser (CORS), so we let the team flag broken links manually. When set,
-- the UI falls back to a search URL derived from item_code.
--
-- The flag clears automatically whenever pcom_link is updated (handled in
-- the products service).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS pcom_link_broken_at TIMESTAMPTZ;

COMMENT ON COLUMN products.pcom_link_broken_at IS
  'Set when a user reports the saved pcom_link as broken. UI then falls back to a publix search URL using item_code. Cleared on next pcom_link update.';
