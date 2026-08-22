-- Aligns every image bucket with the application validation and admin policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('events', 'events', true, 10485760, array['image/jpeg','image/png','image/webp','image/avif']),
  ('gallery', 'gallery', true, 10485760, array['image/jpeg','image/png','image/webp','image/avif']),
  ('services', 'services', true, 10485760, array['image/jpeg','image/png','image/webp','image/avif']),
  ('home-banners', 'home-banners', true, 10485760, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads GOOM images" on storage.objects;
create policy "Public reads GOOM images" on storage.objects
for select to anon
using (bucket_id in ('events','gallery','services','home-banners'));

drop policy if exists "Admins upload GOOM images" on storage.objects;
create policy "Admins upload GOOM images" on storage.objects
for insert to authenticated
with check (
  bucket_id in ('events','gallery','services','home-banners')
  and (select public.is_admin())
);

drop policy if exists "Admins update GOOM images" on storage.objects;
create policy "Admins update GOOM images" on storage.objects
for update to authenticated
using (
  bucket_id in ('events','gallery','services','home-banners')
  and (select public.is_admin())
)
with check (
  bucket_id in ('events','gallery','services','home-banners')
  and (select public.is_admin())
);

drop policy if exists "Admins delete GOOM images" on storage.objects;
create policy "Admins delete GOOM images" on storage.objects
for delete to authenticated
using (
  bucket_id in ('events','gallery','services','home-banners')
  and (select public.is_admin())
);
