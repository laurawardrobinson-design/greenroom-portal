-- ============================================================
-- Migration 035: Studio Goals (org-wide directional goals)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.studio_goals (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  description text        NOT NULL,
  horizon     text        NOT NULL CHECK (horizon IN ('long', 'short')),
  sort_order  int         NOT NULL DEFAULT 0,
  created_by  uuid        REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS studio_goals_horizon_idx
  ON public.studio_goals (horizon, sort_order);

ALTER TABLE public.studio_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read studio goals"
  ON public.studio_goals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert studio goals"
  ON public.studio_goals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'Admin')
  );

CREATE POLICY "Admins can update studio goals"
  ON public.studio_goals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'Admin')
  );

CREATE POLICY "Admins can delete studio goals"
  ON public.studio_goals FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'Admin')
  );

-- Seed studio goals
INSERT INTO public.studio_goals (title, description, horizon, sort_order) VALUES
  (
    'Produce our first in-house broadcast spot',
    'Concept through delivery — a broadcast-quality TV campaign produced entirely by the Greenroom studio, no outside production company.',
    'long', 0
  ),
  (
    'Raise the creative bar',
    'Establish a new internal standard for creative output — work that gets held up as the benchmark across Publix marketing.',
    'long', 1
  ),
  (
    'Compress shoot-to-live time',
    'Reduce the time between shoot wrap and campaign going live — faster delivery without sacrificing quality.',
    'long', 2
  ),
  (
    'Establish a post-production handoff process',
    'Every project exits the shoot with a clear delivery timeline and defined post workflow — no more chasing next steps.',
    'short', 0
  ),
  (
    'Complete the studio gear audit',
    'Full inventory of all studio equipment, retire outdated gear, and get the catalog current in Greenroom.',
    'short', 1
  );
