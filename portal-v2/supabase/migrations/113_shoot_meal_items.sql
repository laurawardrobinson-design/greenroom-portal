-- 113: Shoot meal line items
-- Structured menu/order items attached to a ShootMeal so Studio Managers can
-- plan exactly what they're ordering (e.g. "10 turkey wraps", "vegan platter").

create table if not exists shoot_meal_items (
  id          uuid primary key default gen_random_uuid(),
  meal_id     uuid not null references shoot_meals(id) on delete cascade,
  name        text not null,
  quantity    text,                    -- free text so "2 dozen", "1 platter" all fit
  notes       text,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists shoot_meal_items_meal_idx
  on shoot_meal_items(meal_id, sort_order);

alter table shoot_meal_items enable row level security;

create policy "shoot_meal_items_read" on shoot_meal_items
  for select to authenticated using (true);

create policy "shoot_meal_items_write" on shoot_meal_items
  for all to authenticated using (
    get_my_role() in ('Admin', 'Producer', 'Studio')
  );

create trigger shoot_meal_items_updated_at
  before update on shoot_meal_items
  for each row execute function set_updated_at();
