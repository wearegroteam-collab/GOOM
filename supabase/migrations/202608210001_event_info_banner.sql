-- Adds an optional informational banner displayed below each event hero.

alter table public.events
add column if not exists info_banner_url text;
