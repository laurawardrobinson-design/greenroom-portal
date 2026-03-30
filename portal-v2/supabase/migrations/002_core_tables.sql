-- ============================================================
-- Migration 002: Core Tables
-- users, budget_pools, campaigns, shoot_days,
-- campaign_deliverables, campaign_crew, campaign_assets
-- ============================================================

-- Users (linked to Supabase auth.users)
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'Producer',
  active boolean NOT NULL DEFAULT true,
  avatar_url text NOT NULL DEFAULT '',
  vendor_id uuid,  -- FK added after vendors table is created
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Budget Pools (quarterly/yearly budget buckets)
CREATE TABLE public.budget_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Campaigns
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wf_number text NOT NULL DEFAULT '',
  name text NOT NULL,
  brand text NOT NULL DEFAULT '',
  status campaign_status NOT NULL DEFAULT 'Planning',
  production_budget numeric NOT NULL DEFAULT 0,
  budget_pool_id uuid REFERENCES budget_pools(id) ON DELETE SET NULL,
  assets_delivery_date date,
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Shoot Days (individual dates per campaign, not ranges)
CREATE TABLE public.shoot_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  shoot_date date NOT NULL,
  location text NOT NULL DEFAULT '',
  call_time text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Campaign Deliverables (channel specs with crop ratios)
CREATE TABLE public.campaign_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT '',
  format text NOT NULL DEFAULT '',
  width integer NOT NULL DEFAULT 0,
  height integer NOT NULL DEFAULT 0,
  aspect_ratio text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Campaign Crew (internal team assignments)
CREATE TABLE public.campaign_crew (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_on_shoot text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, user_id)
);

-- Campaign Assets (files — split into "Fun" and "Boring" by category)
CREATE TABLE public.campaign_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  vendor_id uuid,  -- FK added after vendors table is created
  file_url text NOT NULL,
  file_name text NOT NULL DEFAULT '',
  file_size bigint NOT NULL DEFAULT 0,
  file_type text NOT NULL DEFAULT '',
  category asset_category NOT NULL DEFAULT 'Other',
  created_at timestamptz NOT NULL DEFAULT now()
);
