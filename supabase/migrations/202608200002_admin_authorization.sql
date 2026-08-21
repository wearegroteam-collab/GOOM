-- Adds explicit administrator authorization to an existing GOOM CMS database.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
grant select on public.admin_users to authenticated;

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

drop policy if exists "Admins can read own membership" on public.admin_users;
create policy "Admins can read own membership" on public.admin_users
for select to authenticated
using (user_id = auth.uid() and active = true);

drop policy if exists "Admins manage events" on public.events;
create policy "Admins manage events" on public.events for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Admins manage services" on public.services;
create policy "Admins manage services" on public.services for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Admins manage gallery" on public.gallery;
create policy "Admins manage gallery" on public.gallery for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Admins manage settings" on public.site_settings;
create policy "Admins manage settings" on public.site_settings for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

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
