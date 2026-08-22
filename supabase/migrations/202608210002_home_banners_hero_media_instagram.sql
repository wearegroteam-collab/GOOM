-- Adds independent responsive home banners, explicit event hero media and Instagram embeds.

alter table public.events
add column if not exists hero_media_type text not null default 'image';

alter table public.events drop constraint if exists events_hero_media_type_check;
alter table public.events add constraint events_hero_media_type_check
check (hero_media_type in ('image', 'video'));

alter table public.event_videos drop constraint if exists event_videos_provider_check;
alter table public.event_videos add constraint event_videos_provider_check
check (provider in ('youtube', 'vimeo', 'instagram', 'mp4', 'embed'));

create table if not exists public.home_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 140),
  alt_text text not null check (char_length(alt_text) between 1 and 300),
  desktop_image_url text not null,
  tablet_image_url text,
  mobile_image_url text,
  button_label text check (button_label is null or char_length(button_label) <= 50),
  button_url text check (button_url is null or char_length(button_url) <= 2048),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists home_banners_active_order_idx
on public.home_banners (active, sort_order);

alter table public.home_banners enable row level security;
grant select on public.home_banners to anon;
grant select, insert, update, delete on public.home_banners to authenticated;

drop policy if exists "Public reads active home banners" on public.home_banners;
create policy "Public reads active home banners" on public.home_banners
for select to anon using (active = true);

drop policy if exists "Admins manage home banners" on public.home_banners;
create policy "Admins manage home banners" on public.home_banners
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('home-banners', 'home-banners', true, 6291456, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads GOOM images" on storage.objects;
create policy "Public reads GOOM images" on storage.objects for select to anon
using (bucket_id in ('events','gallery','services','home-banners'));

drop policy if exists "Admins upload GOOM images" on storage.objects;
create policy "Admins upload GOOM images" on storage.objects for insert to authenticated
with check (bucket_id in ('events','gallery','services','home-banners') and (select public.is_admin()));

drop policy if exists "Admins update GOOM images" on storage.objects;
create policy "Admins update GOOM images" on storage.objects for update to authenticated
using (bucket_id in ('events','gallery','services','home-banners') and (select public.is_admin()))
with check (bucket_id in ('events','gallery','services','home-banners') and (select public.is_admin()));

drop policy if exists "Admins delete GOOM images" on storage.objects;
create policy "Admins delete GOOM images" on storage.objects for delete to authenticated
using (bucket_id in ('events','gallery','services','home-banners') and (select public.is_admin()));
