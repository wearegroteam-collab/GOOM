-- Run this only after creating the user in Supabase Authentication > Users.
-- Replace the email before executing.

insert into public.admin_users (user_id, email, active)
select id, email, true
from auth.users
where lower(email) = lower('juangp.jpa@gmail.com')
on conflict (user_id) do update
set email = excluded.email, active = true;

-- The result must contain exactly one active row.
select au.user_id, au.email, au.active, au.created_at
from public.admin_users au
where lower(au.email) = lower('juangp.jpa@gmail.com');
