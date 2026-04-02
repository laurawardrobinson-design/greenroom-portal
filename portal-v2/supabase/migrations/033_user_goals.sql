-- ============================================================
-- Migration 033: User Goals ("Growing Toward")
-- ============================================================

-- One goal per person — what they're working toward
CREATE TABLE IF NOT EXISTS public.user_goals (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  goal_text            text        NOT NULL,
  current_role_context text        NOT NULL DEFAULT '',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_goals_one_per_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS user_goals_user_id_idx
  ON public.user_goals (user_id);

-- Advice on goals — private between goal owner and admins
CREATE TABLE IF NOT EXISTS public.goal_advice (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     uuid        NOT NULL REFERENCES public.user_goals(id) ON DELETE CASCADE,
  text        text        NOT NULL,
  author_id   uuid        NOT NULL REFERENCES public.users(id),
  author_name text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goal_advice_goal_id_idx
  ON public.goal_advice (goal_id, created_at);

-- RLS for user_goals
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all goals"
  ON public.user_goals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own goal"
  ON public.user_goals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goal"
  ON public.user_goals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goal"
  ON public.user_goals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS for goal_advice
ALTER TABLE public.goal_advice ENABLE ROW LEVEL SECURITY;

-- Advice is private: only the goal owner and admins can read
CREATE POLICY "Goal owner and admins can read advice"
  ON public.goal_advice FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_goals g
      WHERE g.id = goal_id AND g.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'Admin'
    )
  );

CREATE POLICY "Authenticated users can insert advice"
  ON public.goal_advice FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can delete their own advice"
  ON public.goal_advice FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);
