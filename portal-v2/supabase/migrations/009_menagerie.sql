-- Menagerie: secret creature collection tracking
create table menagerie_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  creature_key text not null,
  discovered_at timestamptz default now() not null,
  unique(user_id, creature_key)
);

alter table menagerie_collections enable row level security;

create policy "Users can read own collection"
  on menagerie_collections for select using (auth.uid() = user_id);

create policy "Users can insert own discoveries"
  on menagerie_collections for insert with check (auth.uid() = user_id);
