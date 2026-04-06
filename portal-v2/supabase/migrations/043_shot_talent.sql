-- Structured talent/casting for shots
-- talent_number is campaign-scoped (T1, T2, T3 = same person across shots)
CREATE TABLE public.shot_talent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shot_id uuid NOT NULL REFERENCES public.shot_list_shots(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  talent_number int NOT NULL,
  label text NOT NULL DEFAULT '',
  age_range text NOT NULL DEFAULT 'Open',
  gender text NOT NULL DEFAULT 'Open',
  ethnicity text NOT NULL DEFAULT 'Open',
  skin_tone text NOT NULL DEFAULT 'Open',
  hair text NOT NULL DEFAULT 'Open',
  build text NOT NULL DEFAULT 'Open',
  wardrobe_notes text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_shot_talent_shot ON public.shot_talent(shot_id);
CREATE INDEX idx_shot_talent_campaign ON public.shot_talent(campaign_id);

-- Prevent duplicate talent_number per shot
CREATE UNIQUE INDEX idx_shot_talent_unique ON public.shot_talent(shot_id, talent_number);

-- RLS
ALTER TABLE public.shot_talent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read shot_talent"
  ON public.shot_talent FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert shot_talent"
  ON public.shot_talent FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update shot_talent"
  ON public.shot_talent FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete shot_talent"
  ON public.shot_talent FOR DELETE TO authenticated USING (true);
