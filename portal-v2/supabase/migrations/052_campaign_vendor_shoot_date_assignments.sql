-- Store optional shoot-date scoping for vendor assignments.
-- NULL = all shoot dates (legacy/default)
-- '{}' = post-only / no on-set call-sheet dates
-- {uuid...} = only these shoot dates

ALTER TABLE public.campaign_vendors
ADD COLUMN IF NOT EXISTS assigned_shoot_date_ids uuid[] DEFAULT NULL;

COMMENT ON COLUMN public.campaign_vendors.assigned_shoot_date_ids IS
  'Optional shoot_date IDs for vendor call-sheet inclusion. NULL means all dates.';
