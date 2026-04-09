-- Studio Management: spaces, reservations, and shoot meal coordination

-- ─────────────────────────────────────────────
-- 1. Studio Spaces (static reference data)
-- ─────────────────────────────────────────────
create table if not exists studio_spaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null check (type in (
                'shooting_bay', 'set_kitchen', 'prep_kitchen',
                'wardrobe', 'multipurpose', 'conference',
                'equipment_storage', 'prop_storage'
              )),
  capacity    int,              -- seated capacity where relevant
  notes       text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- Seed the Greenroom spaces
insert into studio_spaces (name, type, capacity, sort_order) values
  ('Bay 1',                 'shooting_bay',       null, 1),
  ('Bay 2',                 'shooting_bay',       null, 2),
  ('Bay 3',                 'shooting_bay',       null, 3),
  ('Bay 4',                 'shooting_bay',       null, 4),
  ('Bay 5 / Set Kitchen',   'set_kitchen',        null, 5),
  ('Prep Kitchen – Bay A',  'prep_kitchen',       null, 6),
  ('Prep Kitchen – Bay B',  'prep_kitchen',       null, 7),
  ('Wardrobe / Dressing',   'wardrobe',           null, 8),
  ('Multipurpose Area',     'multipurpose',       null, 9),
  ('Conference Room',       'conference',            8, 10),
  ('Equipment Storage',     'equipment_storage',  null, 11),
  ('Prop Storage',          'prop_storage',       null, 12)
on conflict do nothing;

-- ─────────────────────────────────────────────
-- 2. Space Reservations
-- ─────────────────────────────────────────────
create table if not exists space_reservations (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  space_id        uuid not null references studio_spaces(id) on delete cascade,
  reserved_date   date not null,
  start_time      time,
  end_time        time,
  notes           text,
  reserved_by     uuid not null references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- A space can only be reserved once per day (one block per day model)
  unique (space_id, reserved_date)
);

create index if not exists space_reservations_campaign_idx on space_reservations(campaign_id);
create index if not exists space_reservations_date_idx on space_reservations(reserved_date);

-- ─────────────────────────────────────────────
-- 3. Shoot Meals (Food & Crafty coordination)
-- ─────────────────────────────────────────────
create table if not exists shoot_meals (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  shoot_date      date not null,
  meal_type       text not null check (meal_type in ('crafty', 'breakfast', 'lunch', 'dinner', 'snacks')),
  location        text not null check (location in ('greenroom', 'outside')),

  -- Who is responsible for this meal
  handler_role    text not null check (handler_role in ('studio', 'producer')),
  handler_id      uuid references users(id),

  -- Crew details (collaborative — either role can fill this in)
  headcount       int,
  dietary_notes   text,    -- restrictions and hard requirements
  preferences     text,    -- nice-to-haves, themes, preferences

  -- Logistics
  vendor          text,    -- caterer / restaurant / grocery
  delivery_time   time,
  notes           text,

  -- Status
  status          text not null default 'pending'
                  check (status in ('pending', 'ordered', 'confirmed', 'received', 'set')),

  created_by      uuid not null references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists shoot_meals_campaign_idx on shoot_meals(campaign_id);
create index if not exists shoot_meals_date_idx on shoot_meals(shoot_date);

-- ─────────────────────────────────────────────
-- 4. RLS Policies
-- ─────────────────────────────────────────────

-- studio_spaces: read-only for all authenticated users
alter table studio_spaces enable row level security;
create policy "studio_spaces_read" on studio_spaces
  for select to authenticated using (true);

-- space_reservations: all authenticated can read; producers/studio/admin can insert/update/delete
alter table space_reservations enable row level security;
create policy "space_reservations_read" on space_reservations
  for select to authenticated using (true);
create policy "space_reservations_write" on space_reservations
  for all to authenticated using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('Admin', 'Producer', 'Studio')
    )
  );

-- shoot_meals: all authenticated can read; studio/producer/admin can write
alter table shoot_meals enable row level security;
create policy "shoot_meals_read" on shoot_meals
  for select to authenticated using (true);
create policy "shoot_meals_write" on shoot_meals
  for all to authenticated using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('Admin', 'Producer', 'Studio')
    )
  );

-- ─────────────────────────────────────────────
-- 5. Updated_at triggers
-- ─────────────────────────────────────────────
create trigger space_reservations_updated_at
  before update on space_reservations
  for each row execute function set_updated_at();

create trigger shoot_meals_updated_at
  before update on shoot_meals
  for each row execute function set_updated_at();
