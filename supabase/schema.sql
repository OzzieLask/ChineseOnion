-- 白人Onion — run this once in Supabase: Dashboard > SQL Editor > New query.
-- Replace OWNER_EMAIL below with the email of the owner account you create.

create table if not exists public.cards (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.cards enable row level security;

-- Anyone with the link can read.
drop policy if exists "cards public read" on public.cards;
create policy "cards public read" on public.cards
  for select using (true);

-- Only the owner can add / change / delete.
drop policy if exists "cards owner write" on public.cards;
create policy "cards owner write" on public.cards
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'OWNER_EMAIL')
  with check ((auth.jwt() ->> 'email') = 'OWNER_EMAIL');

-- Public bucket for audio, images and handwriting sketches.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "media owner insert" on storage.objects;
create policy "media owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (auth.jwt() ->> 'email') = 'OWNER_EMAIL');

drop policy if exists "media owner update" on storage.objects;
create policy "media owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (auth.jwt() ->> 'email') = 'OWNER_EMAIL');

drop policy if exists "media owner delete" on storage.objects;
create policy "media owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (auth.jwt() ->> 'email') = 'OWNER_EMAIL');
