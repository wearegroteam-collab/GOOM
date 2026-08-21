-- Adds optional Showpass embeds and a future-ready one-to-many video model.

alter table public.events
add column if not exists showpass_widget_code text;

create table if not exists public.event_videos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  url text not null check (char_length(url) <= 2048),
  provider text not null check (provider in ('youtube', 'vimeo', 'mp4', 'embed')),
  aspect_ratio text not null default 'auto' check (aspect_ratio in ('auto', '16:9', '9:16', '4:5', '1:1')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists event_videos_event_order_idx
on public.event_videos (event_id, sort_order);

alter table public.event_videos enable row level security;
grant select on public.event_videos to anon;
grant select, insert, update, delete on public.event_videos to authenticated;

drop policy if exists "Public reads videos for published events" on public.event_videos;
create policy "Public reads videos for published events" on public.event_videos
for select to anon
using (
  exists (
    select 1 from public.events
    where events.id = event_videos.event_id
      and events.status in ('published', 'past')
  )
);

drop policy if exists "Admins manage event videos" on public.event_videos;
create policy "Admins manage event videos" on public.event_videos
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
