-- ============================================================
-- Migration 055: Rename default studio user to Astasia
-- ============================================================

UPDATE public.users
SET name = 'Astasia'
WHERE id = '30ae1e49-ba51-4b73-b301-f75be9fbbfde';
