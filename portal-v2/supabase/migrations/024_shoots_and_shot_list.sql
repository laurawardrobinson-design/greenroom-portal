-- ============================================================
-- Migration 024: Shoots refactor + Shot List + Schedule fields
-- Creates shoots/shoot_dates/shoot_crew (replacing flat shoot_days),
-- shot_list_setups/shots/deliverable_links, and schedule fields
-- on shoot_dates for call sheet builder.
-- ============================================================

CREATE TYPE shoot_type AS ENUM ('Photo', 'Video', 'Hybrid', 'Other');

CREATE TABLE public.shoots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  shoot_type shoot_type NOT NULL DEFAULT 'Photo',
  location text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  crew_varies_by_day boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shoot_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_id uuid NOT NULL REFERENCES shoots(id) ON DELETE CASCADE,
  shoot_date date NOT NULL,
  call_time time,
  location text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  notes_for_crew text NOT NULL DEFAULT '',
  parking_directions text NOT NULL DEFAULT '',
  weather_notes text NOT NULL DEFAULT '',
  special_instructions text NOT NULL DEFAULT '',
  call_sheet_overrides jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shoot_id, shoot_date)
);

CREATE TABLE public.shoot_crew (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_id uuid NOT NULL REFERENCES shoots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shoot_date_id uuid REFERENCES shoot_dates(id) ON DELETE CASCADE,
  role_on_shoot text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE shot_status AS ENUM ('Pending', 'Complete', 'Needs Retouching', 'Cancelled');

CREATE TABLE public.shot_list_setups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  media_type text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shot_list_shots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setup_id uuid NOT NULL REFERENCES shot_list_setups(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  angle text NOT NULL DEFAULT '',
  media_type text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  reference_image_url text,
  status shot_status NOT NULL DEFAULT 'Pending',
  completed_at timestamptz,
  completed_by uuid REFERENCES users(id),
  notes text NOT NULL DEFAULT '',
  talent text NOT NULL DEFAULT '',
  props text NOT NULL DEFAULT '',
  wardrobe text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  shoot_date_id uuid REFERENCES shoot_dates(id) ON DELETE SET NULL,
  estimated_duration_minutes integer DEFAULT 15,
  sort_order_in_day integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shot_deliverable_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shot_id uuid NOT NULL REFERENCES shot_list_shots(id) ON DELETE CASCADE,
  deliverable_id uuid NOT NULL REFERENCES campaign_deliverables(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shot_id, deliverable_id)
);

-- Indexes
CREATE INDEX idx_shoots_campaign ON shoots(campaign_id);
CREATE INDEX idx_shoot_dates_shoot ON shoot_dates(shoot_id);
CREATE INDEX idx_shoot_dates_date ON shoot_dates(shoot_date);
CREATE INDEX idx_shoot_crew_shoot ON shoot_crew(shoot_id);
CREATE INDEX idx_shoot_crew_user ON shoot_crew(user_id);
CREATE INDEX idx_setups_campaign ON shot_list_setups(campaign_id);
CREATE INDEX idx_shots_setup ON shot_list_shots(setup_id);
CREATE INDEX idx_shots_campaign ON shot_list_shots(campaign_id);
CREATE INDEX idx_shots_shoot_date ON shot_list_shots(shoot_date_id);
CREATE INDEX idx_deliverable_links_shot ON shot_deliverable_links(shot_id);

-- Triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.shoots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.shot_list_setups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.shot_list_shots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
