-- ============================================================
-- Migration 034: Growth Plan (milestones, highlights, stakeholders)
-- ============================================================

-- Add last_activity_at to user_goals for stale detection
ALTER TABLE public.user_goals
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now();

-- Stakeholders — who can see goal details (owner + assigned people)
CREATE TABLE IF NOT EXISTS public.goal_stakeholders (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     uuid        NOT NULL REFERENCES public.user_goals(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by uuid        NOT NULL REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT goal_stakeholders_unique UNIQUE (goal_id, user_id)
);

CREATE INDEX IF NOT EXISTS goal_stakeholders_goal_id_idx
  ON public.goal_stakeholders (goal_id);
CREATE INDEX IF NOT EXISTS goal_stakeholders_user_id_idx
  ON public.goal_stakeholders (user_id);

-- Milestones — concrete steps toward a goal
CREATE TABLE IF NOT EXISTS public.goal_milestones (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id      uuid        NOT NULL REFERENCES public.user_goals(id) ON DELETE CASCADE,
  description  text        NOT NULL,
  completed    boolean     NOT NULL DEFAULT false,
  completed_at timestamptz,
  target_date  date,
  sort_order   int         NOT NULL DEFAULT 0,
  created_by   uuid        NOT NULL REFERENCES public.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goal_milestones_goal_id_idx
  ON public.goal_milestones (goal_id, sort_order);

-- Highlights — progress updates from the goal owner
CREATE TABLE IF NOT EXISTS public.goal_highlights (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id    uuid        NOT NULL REFERENCES public.user_goals(id) ON DELETE CASCADE,
  text       text        NOT NULL,
  links      text[]      DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goal_highlights_goal_id_idx
  ON public.goal_highlights (goal_id, created_at);

-- Highlight file attachments
CREATE TABLE IF NOT EXISTS public.goal_highlight_files (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id uuid        REFERENCES public.goal_highlights(id) ON DELETE CASCADE,
  file_url     text        NOT NULL,
  file_name    text        NOT NULL,
  file_size    int         NOT NULL DEFAULT 0,
  file_type    text        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goal_highlight_files_highlight_id_idx
  ON public.goal_highlight_files (highlight_id);

-- Highlight feedback from stakeholders
CREATE TABLE IF NOT EXISTS public.goal_highlight_feedback (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id uuid        NOT NULL REFERENCES public.goal_highlights(id) ON DELETE CASCADE,
  text         text        NOT NULL,
  author_id    uuid        NOT NULL REFERENCES public.users(id),
  author_name  text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goal_highlight_feedback_highlight_id_idx
  ON public.goal_highlight_feedback (highlight_id, created_at);

-- Storage bucket for goal highlight files
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('goal-files', 'goal-files', false, 20971520)  -- 20MB limit, private
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "goal_files_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'goal-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "goal_files_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'goal-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "goal_files_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'goal-files' AND auth.uid() IS NOT NULL);

-- ============================================================
-- RLS helper: is_goal_viewer checks if user is goal owner or stakeholder
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_goal_viewer(p_goal_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_goals g
    WHERE g.id = p_goal_id AND g.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.goal_stakeholders s
    WHERE s.goal_id = p_goal_id AND s.user_id = auth.uid()
  );
$$;

-- ============================================================
-- RLS policies for goal_stakeholders
-- ============================================================
ALTER TABLE public.goal_stakeholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Goal viewers can read stakeholders"
  ON public.goal_stakeholders FOR SELECT
  TO authenticated
  USING (public.is_goal_viewer(goal_id));

CREATE POLICY "Admins can insert stakeholders"
  ON public.goal_stakeholders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'Admin'
    )
  );

CREATE POLICY "Admins can delete stakeholders"
  ON public.goal_stakeholders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'Admin'
    )
  );

-- ============================================================
-- RLS policies for goal_milestones
-- ============================================================
ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Goal viewers can read milestones"
  ON public.goal_milestones FOR SELECT
  TO authenticated
  USING (public.is_goal_viewer(goal_id));

CREATE POLICY "Goal viewers can insert milestones"
  ON public.goal_milestones FOR INSERT
  TO authenticated
  WITH CHECK (public.is_goal_viewer(goal_id));

CREATE POLICY "Goal viewers can update milestones"
  ON public.goal_milestones FOR UPDATE
  TO authenticated
  USING (public.is_goal_viewer(goal_id));

CREATE POLICY "Goal viewers can delete milestones"
  ON public.goal_milestones FOR DELETE
  TO authenticated
  USING (public.is_goal_viewer(goal_id));

-- ============================================================
-- RLS policies for goal_highlights
-- ============================================================
ALTER TABLE public.goal_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Goal viewers can read highlights"
  ON public.goal_highlights FOR SELECT
  TO authenticated
  USING (public.is_goal_viewer(goal_id));

CREATE POLICY "Goal owner can insert highlights"
  ON public.goal_highlights FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_goals g
      WHERE g.id = goal_id AND g.user_id = auth.uid()
    )
  );

-- ============================================================
-- RLS policies for goal_highlight_files
-- ============================================================
ALTER TABLE public.goal_highlight_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Goal viewers can read highlight files"
  ON public.goal_highlight_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goal_highlights h
      WHERE h.id = highlight_id AND public.is_goal_viewer(h.goal_id)
    )
  );

CREATE POLICY "Authenticated users can insert highlight files"
  ON public.goal_highlight_files FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- RLS policies for goal_highlight_feedback
-- ============================================================
ALTER TABLE public.goal_highlight_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Goal viewers can read feedback"
  ON public.goal_highlight_feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goal_highlights h
      WHERE h.id = highlight_id AND public.is_goal_viewer(h.goal_id)
    )
  );

CREATE POLICY "Goal stakeholders can insert feedback"
  ON public.goal_highlight_feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.goal_highlights h
      JOIN public.goal_stakeholders s ON s.goal_id = h.goal_id
      WHERE h.id = highlight_id AND s.user_id = auth.uid()
    )
  );

-- Update existing goal_advice RLS to use stakeholder model instead of Admin role
DROP POLICY IF EXISTS "Goal owner and admins can read advice" ON public.goal_advice;
CREATE POLICY "Goal viewers can read advice"
  ON public.goal_advice FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_goals g
      WHERE g.id = goal_id AND public.is_goal_viewer(g.id)
    )
  );
