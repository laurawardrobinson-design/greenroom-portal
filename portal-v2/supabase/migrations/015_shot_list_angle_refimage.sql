-- Add angle and reference image to shot list shots
ALTER TABLE public.shot_list_shots
  ADD COLUMN IF NOT EXISTS angle text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reference_image_url text;
