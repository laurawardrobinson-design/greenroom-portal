-- 061: wardrobe checkout system + job classes

-- ── 1. Extend wardrobe_items with status, condition, qr_code ─────────────────
alter table public.wardrobe_items
  add column if not exists status text not null default 'Available'
    check (status in ('Available', 'Reserved', 'Checked Out')),
  add column if not exists condition text not null default 'Good'
    check (condition in ('Excellent', 'Good', 'Fair', 'Poor', 'Damaged')),
  add column if not exists qr_code text;

create unique index if not exists wardrobe_items_qr_code_key
  on public.wardrobe_items (qr_code)
  where qr_code is not null;

-- ── 2. Wardrobe checkouts ─────────────────────────────────────────────────────
create table if not exists public.wardrobe_checkouts (
  id               uuid        primary key default gen_random_uuid(),
  wardrobe_item_id uuid        not null references public.wardrobe_items(id) on delete cascade,
  user_id          uuid        references auth.users(id) on delete set null,
  campaign_id      uuid        references public.campaigns(id) on delete set null,
  checked_out_at   timestamptz not null default now(),
  checked_in_at    timestamptz,
  due_date         date,
  condition_out    text        not null default 'Good',
  condition_in     text,
  notes            text        not null default '',
  created_at       timestamptz not null default now()
);

alter table public.wardrobe_checkouts enable row level security;

create policy "wardrobe_checkouts_select" on public.wardrobe_checkouts
  for select using (auth.role() = 'authenticated');
create policy "wardrobe_checkouts_insert" on public.wardrobe_checkouts
  for insert with check (auth.role() = 'authenticated');
create policy "wardrobe_checkouts_update" on public.wardrobe_checkouts
  for update using (auth.role() = 'authenticated');

-- ── 3. Wardrobe reservations ──────────────────────────────────────────────────
create table if not exists public.wardrobe_reservations (
  id               uuid        primary key default gen_random_uuid(),
  wardrobe_item_id uuid        not null references public.wardrobe_items(id) on delete cascade,
  user_id          uuid        references auth.users(id) on delete set null,
  campaign_id      uuid        references public.campaigns(id) on delete set null,
  start_date       date        not null,
  end_date         date        not null,
  status           text        not null default 'Confirmed'
    check (status in ('Confirmed', 'Cancelled', 'Checked Out', 'Completed')),
  notes            text        not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.wardrobe_reservations enable row level security;

create policy "wardrobe_reservations_select" on public.wardrobe_reservations
  for select using (auth.role() = 'authenticated');
create policy "wardrobe_reservations_insert" on public.wardrobe_reservations
  for insert with check (auth.role() = 'authenticated');
create policy "wardrobe_reservations_update" on public.wardrobe_reservations
  for update using (auth.role() = 'authenticated');
create policy "wardrobe_reservations_delete" on public.wardrobe_reservations
  for delete using (auth.role() = 'authenticated');

create trigger wardrobe_reservations_updated_at
  before update on public.wardrobe_reservations
  for each row execute function set_updated_at();

-- ── 4. Job classes ────────────────────────────────────────────────────────────
create table if not exists public.job_classes (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  description text        not null default '',
  standards   text        not null default '',
  created_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.job_classes enable row level security;

create policy "job_classes_select" on public.job_classes
  for select using (auth.role() = 'authenticated');
create policy "job_classes_insert" on public.job_classes
  for insert with check (auth.role() = 'authenticated');
create policy "job_classes_update" on public.job_classes
  for update using (auth.role() = 'authenticated');
create policy "job_classes_delete" on public.job_classes
  for delete using (auth.role() = 'authenticated');

create trigger job_classes_updated_at
  before update on public.job_classes
  for each row execute function set_updated_at();

-- ── 5. Job class items (wardrobe items linked to a role) ──────────────────────
create table if not exists public.job_class_items (
  id               uuid        primary key default gen_random_uuid(),
  job_class_id     uuid        not null references public.job_classes(id) on delete cascade,
  wardrobe_item_id uuid        not null references public.wardrobe_items(id) on delete cascade,
  notes            text        not null default '',
  sort_order       int         not null default 0,
  created_at       timestamptz not null default now(),
  unique (job_class_id, wardrobe_item_id)
);

alter table public.job_class_items enable row level security;

create policy "job_class_items_select" on public.job_class_items
  for select using (auth.role() = 'authenticated');
create policy "job_class_items_insert" on public.job_class_items
  for insert with check (auth.role() = 'authenticated');
create policy "job_class_items_update" on public.job_class_items
  for update using (auth.role() = 'authenticated');
create policy "job_class_items_delete" on public.job_class_items
  for delete using (auth.role() = 'authenticated');

-- ── 6. Job class notes (shoot comments) ──────────────────────────────────────
create table if not exists public.job_class_notes (
  id           uuid        primary key default gen_random_uuid(),
  job_class_id uuid        not null references public.job_classes(id) on delete cascade,
  text         text        not null,
  author_id    uuid        references auth.users(id) on delete set null,
  author_name  text        not null default '',
  campaign_id  uuid        references public.campaigns(id) on delete set null,
  created_at   timestamptz not null default now()
);

alter table public.job_class_notes enable row level security;

create policy "job_class_notes_select" on public.job_class_notes
  for select using (auth.role() = 'authenticated');
create policy "job_class_notes_insert" on public.job_class_notes
  for insert with check (auth.role() = 'authenticated');
create policy "job_class_notes_delete" on public.job_class_notes
  for delete using (auth.role() = 'authenticated');

-- ── 7. Atomic checkout RPC ────────────────────────────────────────────────────
create or replace function public.wardrobe_atomic_checkout(
  p_wardrobe_item_id uuid,
  p_user_id          uuid,
  p_campaign_id      uuid    default null,
  p_condition        text    default 'Good',
  p_notes            text    default '',
  p_due_date         date    default null
)
returns uuid as $$
declare
  v_checkout_id    uuid;
  v_current_status text;
begin
  select status into v_current_status
  from wardrobe_items
  where id = p_wardrobe_item_id
  for update;

  if v_current_status is null then
    raise exception 'Wardrobe item not found';
  end if;

  if v_current_status != 'Available' and v_current_status != 'Reserved' then
    raise exception 'Item is not available (status: %)', v_current_status;
  end if;

  insert into wardrobe_checkouts
    (wardrobe_item_id, user_id, campaign_id, condition_out, notes, due_date)
  values
    (p_wardrobe_item_id, p_user_id, p_campaign_id, p_condition, p_notes, p_due_date)
  returning id into v_checkout_id;

  update wardrobe_items set status = 'Checked Out' where id = p_wardrobe_item_id;

  return v_checkout_id;
end;
$$ language plpgsql security definer;

-- ── 8. Atomic checkin RPC ─────────────────────────────────────────────────────
create or replace function public.wardrobe_atomic_checkin(
  p_checkout_id uuid,
  p_condition   text default 'Good',
  p_notes       text default ''
)
returns void as $$
declare
  v_wardrobe_item_id uuid;
begin
  select wardrobe_item_id into v_wardrobe_item_id
  from wardrobe_checkouts
  where id = p_checkout_id and checked_in_at is null
  for update;

  if v_wardrobe_item_id is null then
    raise exception 'Checkout not found or already checked in';
  end if;

  update wardrobe_checkouts
  set checked_in_at = now(),
      condition_in  = p_condition,
      notes         = case when p_notes != '' then p_notes else notes end
  where id = p_checkout_id;

  update wardrobe_items
  set status    = 'Available',
      condition = p_condition
  where id = v_wardrobe_item_id;
end;
$$ language plpgsql security definer;
