-- Wardrobe: manage Publix uniforms for shoots

create table if not exists public.wardrobe_items (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  category    text        not null,
  description text        not null default '',
  shooting_notes text     not null default '',
  restrictions   text     not null default '',
  guide_url   text        null,
  image_url   text        null,
  created_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.wardrobe_items enable row level security;

create policy "wardrobe_items_select" on public.wardrobe_items
  for select using (auth.role() = 'authenticated');

create policy "wardrobe_items_insert" on public.wardrobe_items
  for insert with check (auth.role() = 'authenticated');

create policy "wardrobe_items_update" on public.wardrobe_items
  for update using (auth.role() = 'authenticated');

create policy "wardrobe_items_delete" on public.wardrobe_items
  for delete using (auth.role() = 'authenticated');

create trigger wardrobe_items_updated_at
  before update on public.wardrobe_items
  for each row execute function set_updated_at();
