-- GOOM first-party ticketing: inventory, orders, individual QR tickets and audit.
-- Run after the existing GOOM CMS migrations.

create extension if not exists pgcrypto;

alter table public.events
  add column if not exists capacity integer check (capacity is null or capacity >= 0),
  add column if not exists sales_enabled boolean not null default false;

create sequence if not exists public.goom_order_number_seq start 1;
create sequence if not exists public.goom_ticket_number_seq start 1;

create table if not exists public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  quantity_total integer not null check (quantity_total >= 0),
  quantity_sold integer not null default 0 check (quantity_sold >= 0),
  quantity_reserved integer not null default 0 check (quantity_reserved >= 0),
  sales_start timestamptz,
  sales_end timestamptz,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity_sold + quantity_reserved <= quantity_total),
  check (sales_end is null or sales_start is null or sales_end > sales_start)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  order_number text not null unique default ('GOOM-ORD-' || lpad(nextval('public.goom_order_number_seq')::text, 6, '0')),
  event_id uuid not null references public.events(id) on delete restrict,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  fees_cents integer not null default 0 check (fees_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  currency text not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled','refunded','partially_refunded')),
  payment_provider text not null default 'mock',
  payment_type text not null default 'sale' check (payment_type in ('sale','complimentary')),
  provider_payment_id text,
  provider_order_id text,
  reservation_expires_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  created_at timestamptz not null default now(),
  unique (order_id, ticket_type_id)
);

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'active' check (status in ('active','converted','released')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (order_id, ticket_type_id)
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  ticket_number text not null unique,
  verification_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  attendee_name text,
  attendee_email text,
  status text not null default 'active' check (status in ('active','used','cancelled','refunded')),
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (order_id, ticket_number)
);

create table if not exists public.ticket_scans (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  scanned_by uuid references auth.users(id) on delete set null,
  scan_result text not null check (scan_result in ('valid','already_used','cancelled','refunded','invalid')),
  scanned_value_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  account_reference text,
  account_name text,
  location_reference text,
  location_name text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  connected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  template text not null,
  provider_message_id text,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (order_id, template)
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  provider_refund_id text,
  idempotency_key text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ticket_types_event_id_idx on public.ticket_types(event_id, active, sort_order);
create index if not exists orders_order_number_idx on public.orders(order_number);
create index if not exists orders_customer_email_idx on public.orders(lower(customer_email));
create index if not exists orders_event_status_created_idx on public.orders(event_id, status, created_at desc);
create index if not exists tickets_ticket_number_idx on public.tickets(ticket_number);
create index if not exists tickets_verification_token_idx on public.tickets(verification_token);
create index if not exists tickets_event_id_idx on public.tickets(event_id);
create index if not exists ticket_scans_ticket_id_idx on public.ticket_scans(ticket_id, created_at desc);
create index if not exists reservations_expiry_idx on public.inventory_reservations(status, expires_at);
create index if not exists webhook_events_lookup_idx on public.payment_webhook_events(provider, provider_event_id);
create unique index if not exists refunds_one_active_full_idx on public.refunds(order_id) where status in ('pending','completed');

drop trigger if exists ticket_types_set_updated_at on public.ticket_types;
create trigger ticket_types_set_updated_at before update on public.ticket_types
for each row execute function public.set_updated_at();
drop trigger if exists payment_connections_set_updated_at on public.payment_connections;
create trigger payment_connections_set_updated_at before update on public.payment_connections
for each row execute function public.set_updated_at();

create or replace function public.release_expired_ticket_reservations()
returns integer language plpgsql security definer set search_path = public as $$
declare
  reservation record;
  released_count integer := 0;
begin
  for reservation in
    select r.id, r.order_id, r.ticket_type_id, r.quantity
    from public.inventory_reservations r
    where r.status = 'active' and r.expires_at <= now()
    for update skip locked
  loop
    update public.ticket_types
      set quantity_reserved = greatest(0, quantity_reserved - reservation.quantity)
      where id = reservation.ticket_type_id;
    update public.inventory_reservations set status = 'released' where id = reservation.id;
    update public.orders set status = 'cancelled', cancelled_at = now()
      where id = reservation.order_id and status = 'pending';
    released_count := released_count + 1;
  end loop;
  return released_count;
end;
$$;

create or replace function public.create_ticket_order(
  p_event_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_payment_provider text,
  p_items jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  selected_event public.events%rowtype;
  new_order public.orders%rowtype;
  item record;
  subtotal integer := 0;
  chosen_currency text := null;
  requested_count integer;
  matched_count integer;
  requested_quantity integer;
  expiry timestamptz := now() + interval '15 minutes';
begin
  perform public.release_expired_ticket_reservations();
  if coalesce(trim(p_customer_name), '') = '' or p_customer_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'INVALID_BUYER';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_CART'; end if;
  if p_payment_provider not in ('mock','square') then raise exception 'INVALID_PAYMENT_PROVIDER'; end if;

  select * into selected_event from public.events where id = p_event_id for update;
  if not found or selected_event.status <> 'published' or not selected_event.sales_enabled then raise exception 'SALES_DISABLED'; end if;

  select count(*) into requested_count from (
    select distinct x.ticket_type_id
    from jsonb_to_recordset(p_items) as x(ticket_type_id uuid, quantity integer)
    where x.quantity > 0
  ) q;
  select count(*) into matched_count from public.ticket_types tt
    join (select x.ticket_type_id, sum(x.quantity)::integer quantity from jsonb_to_recordset(p_items) as x(ticket_type_id uuid, quantity integer) where x.quantity > 0 group by x.ticket_type_id) q
      on q.ticket_type_id = tt.id
    where tt.event_id = p_event_id;
  if requested_count = 0 or matched_count <> requested_count then raise exception 'INVALID_TICKET_TYPE'; end if;
  select coalesce(sum(x.quantity),0)::integer into requested_quantity from jsonb_to_recordset(p_items) as x(ticket_type_id uuid, quantity integer) where x.quantity > 0;
  if requested_quantity > 12 then raise exception 'ORDER_LIMIT_EXCEEDED'; end if;
  if selected_event.capacity is not null and (
    (select coalesce(sum(quantity_sold + quantity_reserved),0) from public.ticket_types where event_id = p_event_id) + requested_quantity > selected_event.capacity
  ) then raise exception 'INSUFFICIENT_EVENT_CAPACITY'; end if;

  insert into public.orders(event_id, customer_name, customer_email, customer_phone, payment_provider, reservation_expires_at)
  values (p_event_id, trim(p_customer_name), lower(trim(p_customer_email)), nullif(trim(p_customer_phone), ''), p_payment_provider, expiry)
  returning * into new_order;

  for item in
    select tt.*, q.quantity requested_quantity
    from public.ticket_types tt
    join (select x.ticket_type_id, sum(x.quantity)::integer quantity from jsonb_to_recordset(p_items) as x(ticket_type_id uuid, quantity integer) where x.quantity > 0 group by x.ticket_type_id) q
      on q.ticket_type_id = tt.id
    where tt.event_id = p_event_id
    order by tt.id
    for update of tt
  loop
    if not item.active or (item.sales_start is not null and item.sales_start > now()) or (item.sales_end is not null and item.sales_end < now()) then raise exception 'TICKET_NOT_ON_SALE'; end if;
    if item.quantity_sold + item.quantity_reserved + item.requested_quantity > item.quantity_total then raise exception 'INSUFFICIENT_INVENTORY'; end if;
    if chosen_currency is null then chosen_currency := item.currency; elsif chosen_currency <> item.currency then raise exception 'MIXED_CURRENCY'; end if;
    subtotal := subtotal + (item.price_cents * item.requested_quantity);
    insert into public.order_items(order_id, ticket_type_id, quantity, unit_price_cents, total_cents)
      values (new_order.id, item.id, item.requested_quantity, item.price_cents, item.price_cents * item.requested_quantity);
    insert into public.inventory_reservations(order_id, ticket_type_id, quantity, expires_at)
      values (new_order.id, item.id, item.requested_quantity, expiry);
    update public.ticket_types set quantity_reserved = quantity_reserved + item.requested_quantity where id = item.id;
  end loop;

  update public.orders set subtotal_cents = subtotal, total_cents = subtotal, currency = chosen_currency where id = new_order.id
    returning * into new_order;
  return jsonb_build_object('id', new_order.id, 'public_token', new_order.public_token, 'order_number', new_order.order_number, 'total_cents', new_order.total_cents, 'currency', new_order.currency, 'expires_at', new_order.reservation_expires_at);
end;
$$;

create or replace function public.finalize_paid_ticket_order(
  p_order_id uuid,
  p_provider_payment_id text,
  p_provider_order_id text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  paid_order public.orders%rowtype;
  item record;
  ticket_index integer;
  event_code text;
begin
  select * into paid_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if paid_order.status in ('paid','partially_refunded','refunded') then
    return jsonb_build_object('order_id', paid_order.id, 'status', paid_order.status, 'already_processed', true);
  end if;
  if paid_order.status <> 'pending' then raise exception 'ORDER_NOT_PAYABLE'; end if;

  select upper(substr(regexp_replace(coalesce(slug, title), '[^a-zA-Z0-9]', '', 'g'), 1, 4)) into event_code from public.events where id = paid_order.event_id;
  for item in select oi.*, tt.name ticket_type_name from public.order_items oi join public.ticket_types tt on tt.id = oi.ticket_type_id where oi.order_id = paid_order.id order by oi.id
  loop
    update public.ticket_types set quantity_reserved = greatest(0, quantity_reserved - item.quantity), quantity_sold = quantity_sold + item.quantity where id = item.ticket_type_id;
    update public.inventory_reservations set status = 'converted' where order_id = paid_order.id and ticket_type_id = item.ticket_type_id and status = 'active';
    for ticket_index in 1..item.quantity loop
      insert into public.tickets(order_id, event_id, ticket_type_id, ticket_number, attendee_name, attendee_email)
      values (paid_order.id, paid_order.event_id, item.ticket_type_id, 'GOOM-' || coalesce(nullif(event_code,''),'EVT') || '-' || lpad(nextval('public.goom_ticket_number_seq')::text, 6, '0'), paid_order.customer_name, paid_order.customer_email)
      on conflict do nothing;
    end loop;
  end loop;
  update public.orders set status = 'paid', paid_at = coalesce(paid_at, now()), provider_payment_id = coalesce(provider_payment_id, p_provider_payment_id), provider_order_id = coalesce(provider_order_id, p_provider_order_id)
    where id = paid_order.id;
  insert into public.audit_logs(action, entity_type, entity_id, metadata) values ('tickets.created', 'order', paid_order.id, jsonb_build_object('provider_payment_id', p_provider_payment_id));
  return jsonb_build_object('order_id', paid_order.id, 'status', 'paid', 'already_processed', false);
end;
$$;

create or replace function public.fail_ticket_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare item record;
begin
  if not exists (select 1 from public.orders where id = p_order_id and status = 'pending' for update) then return; end if;
  for item in select ticket_type_id, quantity from public.inventory_reservations where order_id = p_order_id and status = 'active' for update loop
    update public.ticket_types set quantity_reserved = greatest(0, quantity_reserved - item.quantity) where id = item.ticket_type_id;
  end loop;
  update public.inventory_reservations set status = 'released' where order_id = p_order_id and status = 'active';
  update public.orders set status = 'failed' where id = p_order_id;
end;
$$;

create or replace function public.scan_ticket(p_value text, p_check_in boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare found_ticket record; result text; current_user_id uuid := auth.uid();
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select t.*, e.title event_name, tt.name ticket_type_name, au.email checked_in_by_email
    into found_ticket from public.tickets t
    join public.events e on e.id = t.event_id
    join public.ticket_types tt on tt.id = t.ticket_type_id
    left join auth.users au on au.id = t.checked_in_by
    where t.verification_token = p_value or upper(t.ticket_number) = upper(p_value)
    for update of t;
  if not found then
    insert into public.ticket_scans(scan_result, scanned_by, scanned_value_hash) values ('invalid', current_user_id, encode(digest(p_value, 'sha256'),'hex'));
    return jsonb_build_object('result','invalid');
  end if;
  result := case found_ticket.status when 'active' then 'valid' when 'used' then 'already_used' when 'cancelled' then 'cancelled' when 'refunded' then 'refunded' else 'invalid' end;
  if p_check_in and found_ticket.status = 'active' then
    update public.tickets set status = 'used', checked_in_at = now(), checked_in_by = current_user_id where id = found_ticket.id and status = 'active'
      returning checked_in_at into found_ticket.checked_in_at;
    result := 'valid';
    insert into public.audit_logs(user_id, action, entity_type, entity_id) values (current_user_id, 'ticket.checked_in', 'ticket', found_ticket.id);
  end if;
  insert into public.ticket_scans(ticket_id, event_id, scanned_by, scan_result) values (found_ticket.id, found_ticket.event_id, current_user_id, result);
  return jsonb_build_object('result', result, 'ticket_id', found_ticket.id, 'ticket_number', found_ticket.ticket_number, 'event_name', found_ticket.event_name, 'ticket_type', found_ticket.ticket_type_name, 'customer', found_ticket.attendee_name, 'checked_in_at', found_ticket.checked_in_at, 'checked_in_by', found_ticket.checked_in_by_email);
end;
$$;

create or replace function public.create_complimentary_tickets(
  p_event_id uuid, p_ticket_type_id uuid, p_quantity integer, p_name text, p_email text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare new_order public.orders%rowtype; selected_type public.ticket_types%rowtype; selected_event public.events%rowtype; ticket_index integer; event_code text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_quantity < 1 or p_quantity > 50 or coalesce(trim(p_name),'') = '' or p_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'INVALID_INPUT'; end if;
  select * into selected_type from public.ticket_types where id = p_ticket_type_id and event_id = p_event_id for update;
  if not found or selected_type.quantity_sold + selected_type.quantity_reserved + p_quantity > selected_type.quantity_total then raise exception 'INSUFFICIENT_INVENTORY'; end if;
  select * into selected_event from public.events where id = p_event_id for update;
  if selected_event.capacity is not null and ((select coalesce(sum(quantity_sold + quantity_reserved),0) from public.ticket_types where event_id = p_event_id) + p_quantity > selected_event.capacity) then raise exception 'INSUFFICIENT_EVENT_CAPACITY'; end if;
  insert into public.orders(event_id, customer_name, customer_email, subtotal_cents, total_cents, currency, status, payment_provider, payment_type, paid_at)
    values (p_event_id, trim(p_name), lower(trim(p_email)), 0, 0, selected_type.currency, 'paid', 'complimentary', 'complimentary', now()) returning * into new_order;
  insert into public.order_items(order_id, ticket_type_id, quantity, unit_price_cents, total_cents) values (new_order.id, selected_type.id, p_quantity, 0, 0);
  update public.ticket_types set quantity_sold = quantity_sold + p_quantity where id = selected_type.id;
  select upper(substr(regexp_replace(coalesce(slug, title), '[^a-zA-Z0-9]', '', 'g'), 1, 4)) into event_code from public.events where id = p_event_id;
  for ticket_index in 1..p_quantity loop
    insert into public.tickets(order_id,event_id,ticket_type_id,ticket_number,attendee_name,attendee_email)
    values (new_order.id,p_event_id,selected_type.id,'GOOM-' || coalesce(nullif(event_code,''),'EVT') || '-' || lpad(nextval('public.goom_ticket_number_seq')::text,6,'0'),trim(p_name),lower(trim(p_email)));
  end loop;
  insert into public.audit_logs(user_id,action,entity_type,entity_id,metadata) values (auth.uid(),'tickets.complimentary','order',new_order.id,jsonb_build_object('quantity',p_quantity));
  return jsonb_build_object('order_id',new_order.id,'public_token',new_order.public_token,'order_number',new_order.order_number);
end;
$$;

create or replace function public.finalize_ticket_refund(p_provider_refund_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare selected_refund public.refunds%rowtype; selected_order public.orders%rowtype; item record; new_refunded integer; full_refund boolean;
begin
  select * into selected_refund from public.refunds where provider_refund_id = p_provider_refund_id for update;
  if not found then raise exception 'REFUND_NOT_FOUND'; end if;
  if selected_refund.status = 'completed' then return jsonb_build_object('status','completed','already_processed',true); end if;
  select * into selected_order from public.orders where id = selected_refund.order_id for update;
  new_refunded := least(selected_order.total_cents, selected_order.refunded_cents + selected_refund.amount_cents);
  full_refund := new_refunded >= selected_order.total_cents;
  update public.refunds set status='completed',completed_at=now() where id=selected_refund.id;
  update public.orders set refunded_cents=new_refunded,status=case when full_refund then 'refunded' else 'partially_refunded' end,refunded_at=case when full_refund then now() else refunded_at end where id=selected_order.id;
  if full_refund then
    for item in select ticket_type_id,quantity from public.order_items where order_id=selected_order.id loop
      update public.ticket_types set quantity_sold=greatest(0,quantity_sold-item.quantity) where id=item.ticket_type_id;
    end loop;
    update public.tickets set status='refunded' where order_id=selected_order.id and status <> 'refunded';
  end if;
  insert into public.audit_logs(action,entity_type,entity_id,metadata) values ('order.refunded','order',selected_order.id,jsonb_build_object('amount_cents',selected_refund.amount_cents,'provider_refund_id',p_provider_refund_id));
  return jsonb_build_object('status',case when full_refund then 'refunded' else 'partially_refunded' end,'already_processed',false);
end;
$$;

alter table public.ticket_types enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_scans enable row level security;
alter table public.payment_connections enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.email_deliveries enable row level security;
alter table public.refunds enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Public reads ticket types on sale" on public.ticket_types;
create policy "Public reads ticket types on sale" on public.ticket_types for select to anon, authenticated using (
  active and exists (select 1 from public.events e where e.id = event_id and e.status = 'published' and e.sales_enabled)
);

do $$ declare table_name text; begin
  foreach table_name in array array['ticket_types','orders','order_items','inventory_reservations','tickets','ticket_scans','payment_connections','payment_webhook_events','email_deliveries','refunds','audit_logs']
  loop
    execute format('drop policy if exists "Admins manage %1$s" on public.%1$I', table_name);
    execute format('create policy "Admins manage %1$s" on public.%1$I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', table_name);
  end loop;
end $$;

revoke all on function public.release_expired_ticket_reservations() from public;
revoke all on function public.create_ticket_order(uuid,text,text,text,text,jsonb) from public;
revoke all on function public.finalize_paid_ticket_order(uuid,text,text) from public;
revoke all on function public.fail_ticket_order(uuid) from public;
revoke all on function public.scan_ticket(text,boolean) from public;
revoke all on function public.create_complimentary_tickets(uuid,uuid,integer,text,text) from public;
revoke all on function public.finalize_ticket_refund(text) from public;
grant execute on function public.create_ticket_order(uuid,text,text,text,text,jsonb) to anon, authenticated;
grant execute on function public.scan_ticket(text,boolean) to authenticated;
grant execute on function public.create_complimentary_tickets(uuid,uuid,integer,text,text) to authenticated;
grant execute on function public.release_expired_ticket_reservations() to service_role;
grant execute on function public.finalize_paid_ticket_order(uuid,text,text) to service_role;
grant execute on function public.fail_ticket_order(uuid) to service_role;
grant execute on function public.finalize_ticket_refund(text) to service_role;

grant select on public.ticket_types to anon, authenticated;
grant select, insert, update, delete on public.ticket_types, public.orders, public.order_items, public.inventory_reservations, public.tickets, public.ticket_scans, public.payment_connections, public.payment_webhook_events, public.email_deliveries, public.refunds, public.audit_logs to authenticated;
grant all on public.ticket_types, public.orders, public.order_items, public.inventory_reservations, public.tickets, public.ticket_scans, public.payment_connections, public.payment_webhook_events, public.email_deliveries, public.refunds, public.audit_logs to service_role;
