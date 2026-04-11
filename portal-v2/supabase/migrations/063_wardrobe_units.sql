-- 063: wardrobe units (physical backstock) + job class item enhancements

-- ── 1. wardrobe_units — physical pieces with size/gender ──────────────────────
create table if not exists public.wardrobe_units (
  id               uuid        primary key default gen_random_uuid(),
  wardrobe_item_id uuid        not null references public.wardrobe_items(id) on delete cascade,
  size             text        not null default 'One Size'
    check (size in ('XS','S','M','L','XL','2XL','3XL','One Size','Other')),
  gender           text        not null default 'Unisex'
    check (gender in ('Men''s','Women''s','Unisex')),
  status           text        not null default 'Available'
    check (status in ('Available','Reserved','Checked Out')),
  condition        text        not null default 'Good'
    check (condition in ('Excellent','Good','Fair','Poor','Damaged')),
  qr_code          text,
  notes            text        not null default '',
  created_by       uuid        references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists wardrobe_units_qr_code_key
  on public.wardrobe_units (qr_code)
  where qr_code is not null;

alter table public.wardrobe_units enable row level security;

create policy "wardrobe_units_select" on public.wardrobe_units
  for select using (auth.role() = 'authenticated');
create policy "wardrobe_units_insert" on public.wardrobe_units
  for insert with check (auth.role() = 'authenticated');
create policy "wardrobe_units_update" on public.wardrobe_units
  for update using (auth.role() = 'authenticated');
create policy "wardrobe_units_delete" on public.wardrobe_units
  for delete using (auth.role() = 'authenticated');

create trigger wardrobe_units_updated_at
  before update on public.wardrobe_units
  for each row execute function set_updated_at();

-- ── 2. job_class_items — add gender filter + option_group + required ──────────
alter table public.job_class_items
  add column if not exists gender text not null default 'All'
    check (gender in ('All','Men''s','Women''s')),
  add column if not exists option_group text,
  add column if not exists required boolean not null default true;

-- ── 3. wardrobe_checkouts — add unit FK (backward compat: item FK stays) ──────
alter table public.wardrobe_checkouts
  add column if not exists wardrobe_unit_id uuid
    references public.wardrobe_units(id) on delete set null;

-- ── 4. wardrobe_reservations — add unit FK ────────────────────────────────────
alter table public.wardrobe_reservations
  add column if not exists wardrobe_unit_id uuid
    references public.wardrobe_units(id) on delete set null;

-- ── 5. unit_atomic_checkout RPC ───────────────────────────────────────────────
create or replace function public.unit_atomic_checkout(
  p_unit_id     uuid,
  p_user_id     uuid,
  p_campaign_id uuid    default null,
  p_condition   text    default 'Good',
  p_notes       text    default '',
  p_due_date    date    default null
)
returns uuid as $$
declare
  v_checkout_id    uuid;
  v_current_status text;
begin
  select status into v_current_status
  from wardrobe_units
  where id = p_unit_id
  for update;

  if v_current_status is null then
    raise exception 'Wardrobe unit not found';
  end if;

  if v_current_status != 'Available' and v_current_status != 'Reserved' then
    raise exception 'Unit is not available (status: %)', v_current_status;
  end if;

  insert into wardrobe_checkouts
    (wardrobe_item_id, wardrobe_unit_id, user_id, campaign_id, condition_out, notes, due_date)
  values
    -- wardrobe_item_id populated via unit's parent for legacy compat
    ((select wardrobe_item_id from wardrobe_units where id = p_unit_id),
     p_unit_id, p_user_id, p_campaign_id, p_condition, p_notes, p_due_date)
  returning id into v_checkout_id;

  update wardrobe_units set status = 'Checked Out' where id = p_unit_id;

  return v_checkout_id;
end;
$$ language plpgsql security definer;

-- ── 6. unit_atomic_checkin RPC ────────────────────────────────────────────────
create or replace function public.unit_atomic_checkin(
  p_checkout_id uuid,
  p_condition   text default 'Good',
  p_notes       text default ''
)
returns void as $$
declare
  v_unit_id uuid;
begin
  select wardrobe_unit_id into v_unit_id
  from wardrobe_checkouts
  where id = p_checkout_id and checked_in_at is null
  for update;

  if v_unit_id is null then
    raise exception 'Checkout not found or already checked in (or no unit linked)';
  end if;

  update wardrobe_checkouts
  set checked_in_at = now(),
      condition_in  = p_condition,
      notes         = case when p_notes != '' then p_notes else notes end
  where id = p_checkout_id;

  update wardrobe_units
  set status    = 'Available',
      condition = p_condition
  where id = v_unit_id;
end;
$$ language plpgsql security definer;
