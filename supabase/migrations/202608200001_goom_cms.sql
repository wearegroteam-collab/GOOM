create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  slug text not null unique,
  description text,
  date timestamptz,
  venue text,
  address text,
  city text,
  image_url text,
  ticket_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'past')),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  icon text,
  active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption text,
  active boolean not null default true,
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid() and active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at before update on public.events
for each row execute function public.set_updated_at();

create or replace function public.keep_single_featured_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.featured then
    update public.events set featured = false where featured = true and id <> new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists events_single_featured on public.events;
create trigger events_single_featured before insert or update of featured on public.events
for each row execute function public.keep_single_featured_event();

create unique index if not exists events_only_one_featured_idx on public.events ((featured)) where featured = true;
create index if not exists events_public_idx on public.events (status, date desc);
create index if not exists services_public_idx on public.services (active, sort_order);
create index if not exists gallery_public_idx on public.gallery (active, featured, sort_order);

alter table public.events enable row level security;
alter table public.services enable row level security;
alter table public.gallery enable row level security;
alter table public.site_settings enable row level security;
alter table public.admin_users enable row level security;
grant select on public.admin_users to authenticated;

drop policy if exists "Admins can read own membership" on public.admin_users;
create policy "Admins can read own membership" on public.admin_users
for select to authenticated
using (user_id = auth.uid() and active = true);

drop policy if exists "Public can read published events" on public.events;
create policy "Public can read published events" on public.events for select to anon using (status in ('published', 'past'));
drop policy if exists "Admins manage events" on public.events;
create policy "Admins manage events" on public.events for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Public can read active services" on public.services;
create policy "Public can read active services" on public.services for select to anon using (active = true);
drop policy if exists "Admins manage services" on public.services;
create policy "Admins manage services" on public.services for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Public can read active gallery" on public.gallery;
create policy "Public can read active gallery" on public.gallery for select to anon using (active = true);
drop policy if exists "Admins manage gallery" on public.gallery;
create policy "Admins manage gallery" on public.gallery for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Public can read settings" on public.site_settings;
create policy "Public can read settings" on public.site_settings for select to anon using (true);
drop policy if exists "Admins manage settings" on public.site_settings;
create policy "Admins manage settings" on public.site_settings for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('events', 'events', true, 6291456, array['image/jpeg','image/png','image/webp','image/gif']),
  ('gallery', 'gallery', true, 6291456, array['image/jpeg','image/png','image/webp','image/gif']),
  ('services', 'services', true, 6291456, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads GOOM images" on storage.objects;
create policy "Public reads GOOM images" on storage.objects for select to anon using (bucket_id in ('events','gallery','services'));
drop policy if exists "Admins upload GOOM images" on storage.objects;
create policy "Admins upload GOOM images" on storage.objects for insert to authenticated
with check (bucket_id in ('events','gallery','services') and (select public.is_admin()));
drop policy if exists "Admins update GOOM images" on storage.objects;
create policy "Admins update GOOM images" on storage.objects for update to authenticated
using (bucket_id in ('events','gallery','services') and (select public.is_admin()))
with check (bucket_id in ('events','gallery','services') and (select public.is_admin()));
drop policy if exists "Admins delete GOOM images" on storage.objects;
create policy "Admins delete GOOM images" on storage.objects for delete to authenticated
using (bucket_id in ('events','gallery','services') and (select public.is_admin()));

insert into public.events (title, subtitle, slug, description, date, venue, address, city, image_url, ticket_url, status, featured)
values
  ('Michel Torres', 'Parranda Vallenata', 'michel-torres', 'Halloween night with live music, special guests and prizes for the best costumes.', '2026-10-30 20:00:00-04', 'Columbus Club of Niagara Falls', '6990 Stanley Avenue', 'Niagara Falls, Ontario, Canada', '/images/concert-hero.jpg', null, 'published', true),
  ('Iván Ovalle', 'Fiesta Blanca', 'ivan-ovalle', 'A memorable white party in Niagara Falls.', '2026-05-08 20:00:00-04', 'Niagara Falls', null, 'Niagara Falls', '/images/crowd.jpg', null, 'past', false),
  ('Upcoming Event', 'Coming Soon', 'coming-soon', 'A new GOOM experience is on the way.', null, null, null, 'Niagara Region', '/images/stage.jpg', null, 'published', false)
on conflict (slug) do nothing;

insert into public.services (title, description, image_url, icon, active, sort_order)
select * from (values
  ('Concerts & Live Events', 'From intimate shows to large-scale live events.', '/images/concerts.jpg', 'music', true, 1),
  ('DJ Services', 'Professional entertainment for weddings, private parties and corporate events.', '/images/dj.jpg', 'disc', true, 2),
  ('Weddings & Private Parties', 'Music, production and entertainment designed around your celebration.', '/images/wedding.jpg', 'heart', true, 3),
  ('Catering', 'Food and beverage options for private and corporate events.', '/images/catering.jpg', 'utensils', true, 4),
  ('Event Production', 'Sound, lighting, staging and full event coordination.', '/images/production.jpg', 'sparkles', true, 5)
) as seed(title, description, image_url, icon, active, sort_order)
where not exists (select 1 from public.services);

insert into public.gallery (image_url, caption, active, featured, sort_order)
select * from (values
  ('/images/production.jpg', 'Live concert production', true, true, 1),
  ('/images/crowd.jpg', 'Crowd at a GOOM live event', true, true, 2),
  ('/images/dj.jpg', 'Festival stage and lights', true, true, 3),
  ('/images/wedding.jpg', 'Wedding celebration', true, true, 4),
  ('/images/stage.jpg', 'Event production lighting', true, true, 5),
  ('/images/catering.jpg', 'Catering presentation', true, true, 6)
) as seed(image_url, caption, active, featured, sort_order)
where not exists (select 1 from public.gallery);

insert into public.site_settings (key, value) values
  ('phone', '+1 000 000 0000'), ('whatsapp', '10000000000'), ('email', 'hello@goomevents.ca'),
  ('instagram', ''), ('facebook', ''), ('tiktok', ''), ('youtube', '')
on conflict (key) do nothing;
