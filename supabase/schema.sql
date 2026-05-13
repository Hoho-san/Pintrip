-- ============================================================
-- Pintrip — Supabase Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- PLACES
-- ============================================================
create table if not exists places (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  country      text,
  lat          double precision not null,
  lng          double precision not null,
  visited_at   date,
  notes        text,
  tags         text[] default '{}',
  cover_photo  text,          -- public_url of the cover photo
  created_at   timestamptz default now()
);

-- ============================================================
-- PHOTOS
-- ============================================================
create table if not exists photos (
  id           uuid primary key default gen_random_uuid(),
  place_id     uuid not null references places(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  public_url   text not null,
  ai_caption   text,
  ai_tags      text[] default '{}',
  exif_lat     double precision,
  exif_lng     double precision,
  taken_at     timestamptz,
  created_at   timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists places_user_id_idx on places(user_id);
create index if not exists photos_place_id_idx on photos(place_id);
create index if not exists photos_user_id_idx  on photos(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table places enable row level security;
alter table photos  enable row level security;

-- Places: users only see/edit their own rows
create policy "places_select_own" on places
  for select using (auth.uid() = user_id);

create policy "places_insert_own" on places
  for insert with check (auth.uid() = user_id);

create policy "places_update_own" on places
  for update using (auth.uid() = user_id);

create policy "places_delete_own" on places
  for delete using (auth.uid() = user_id);

-- Photos: users only see/edit their own rows
create policy "photos_select_own" on photos
  for select using (auth.uid() = user_id);

create policy "photos_insert_own" on photos
  for insert with check (auth.uid() = user_id);

create policy "photos_update_own" on photos
  for update using (auth.uid() = user_id);

create policy "photos_delete_own" on photos
  for delete using (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET (run via Supabase dashboard or CLI)
-- ============================================================
-- Create a bucket named "pintrip-photos" with public: false
-- Then add a policy so authenticated users can upload/read their own files:
--
-- insert policy: (auth.uid()::text = (storage.foldername(name))[1])
-- select policy: (auth.uid()::text = (storage.foldername(name))[1])
