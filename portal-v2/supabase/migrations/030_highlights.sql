-- ============================================================
-- Migration 030: Dashboard Highlights
-- ============================================================

CREATE TABLE IF NOT EXISTS public.highlights (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  body        text        NOT NULL,
  emoji       text        NOT NULL DEFAULT '🌟',
  active      boolean     NOT NULL DEFAULT true,
  pinned      boolean     NOT NULL DEFAULT false,
  created_by  uuid        REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read highlights"
  ON public.highlights FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can manage highlights"
  ON public.highlights FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed some sample highlights
INSERT INTO public.highlights (title, body, emoji, active, pinned) VALUES
  ('Summer Grilling Hero Shoot', 'The hero shot from the Summer Grilling campaign was featured on the Publix homepage — incredible work by the whole team!', '🔥', true, true),
  ('New Studio Lighting', 'Studio A got a full lighting upgrade this month. Book your shoots early — the new softboxes are a game-changer.', '💡', true, false),
  ('Did You Know?', 'Publix was founded in 1930 in Lakeland, Florida. That''s over 95 years of serving communities!', '🛒', true, false),
  ('Sarah Chen — 100 Shoots!', 'Sarah just hit her 100th shoot with us. Thank you for your amazing eye and dedication to every single frame.', '📸', true, false);
