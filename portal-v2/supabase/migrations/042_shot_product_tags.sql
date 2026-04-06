-- Add free-text product tags to shots (comma-separated product names not in library)
ALTER TABLE public.shot_list_shots
  ADD COLUMN IF NOT EXISTS product_tags text NOT NULL DEFAULT '';
