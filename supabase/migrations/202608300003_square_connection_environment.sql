-- Persist the Square environment with the OAuth connection.

alter table public.payment_connections
  add column if not exists environment text not null default 'sandbox';

alter table public.payment_connections
  drop constraint if exists payment_connections_environment_check;

alter table public.payment_connections
  add constraint payment_connections_environment_check
  check (environment in ('sandbox','production'));

comment on column public.payment_connections.environment is
  'Square environment that issued the encrypted OAuth access token.';
