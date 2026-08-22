-- Distinguishes legacy defaults from an administrator's explicit hero choice.
-- Existing events with videos automatically use the first video in the hero.

alter table public.events
add column if not exists hero_media_explicit boolean not null default false;

update public.events
set hero_media_type = 'video',
    updated_at = now()
where hero_media_explicit = false
  and exists (
    select 1
    from public.event_videos
    where event_videos.event_id = events.id
  );
