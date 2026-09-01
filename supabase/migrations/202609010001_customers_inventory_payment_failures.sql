-- Preserve checkout attempts, release unpaid inventory, and consolidate GOOM customers.
-- This migration does not alter Square OAuth connections or credentials.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null unique,
  full_name text not null,
  email text not null,
  phone text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (normalized_email = lower(trim(normalized_email)))
);

alter table public.orders
  add column if not exists customer_id uuid references public.customers(id) on delete restrict,
  add column if not exists expired_at timestamptz,
  add column if not exists payment_started_at timestamptz,
  add column if not exists payment_failed_at timestamptz,
  add column if not exists payment_error_http_status integer,
  add column if not exists payment_error_category text,
  add column if not exists payment_error_code text,
  add column if not exists payment_error_detail text;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','paid','failed','expired','cancelled','refunded','partially_refunded'));

create index if not exists customers_search_idx on public.customers (normalized_email, last_seen_at desc);
create index if not exists orders_customer_id_created_idx on public.orders (customer_id, created_at desc);

insert into public.customers (normalized_email, full_name, email, phone, first_seen_at, last_seen_at)
select lower(trim(customer_email)),
       (array_agg(customer_name order by created_at desc))[1],
       (array_agg(customer_email order by created_at desc))[1],
       (array_agg(customer_phone order by (customer_phone is not null) desc, created_at desc))[1],
       min(created_at), max(created_at)
from public.orders
where coalesce(trim(customer_email), '') <> ''
group by lower(trim(customer_email))
on conflict (normalized_email) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  phone = coalesce(excluded.phone, public.customers.phone),
  first_seen_at = least(public.customers.first_seen_at, excluded.first_seen_at),
  last_seen_at = greatest(public.customers.last_seen_at, excluded.last_seen_at),
  updated_at = now();

update public.orders o set customer_id = c.id
from public.customers c
where o.customer_id is null and c.normalized_email = lower(trim(o.customer_email));

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at before update on public.customers
for each row execute function public.set_updated_at();

alter table public.customers enable row level security;
drop policy if exists "Admins manage customers" on public.customers;
create policy "Admins manage customers" on public.customers for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
grant select, insert, update on public.customers to authenticated;
grant all on public.customers to service_role;

create or replace function public.normalize_ticketing_phone(p_phone text)
returns text language plpgsql immutable set search_path = public as $$
declare digits text; cleaned text := trim(coalesce(p_phone, ''));
begin
  if cleaned = '' or cleaned ~ '[A-Za-z]' or cleaned !~ '^[+0-9 ()-]+$' then raise exception 'INVALID_PHONE'; end if;
  digits := regexp_replace(cleaned, '[^0-9]', '', 'g');
  if length(digits) < 9 or length(digits) > 16 then raise exception 'INVALID_PHONE'; end if;
  if length(digits) = 10 then return '+1' || digits; end if;
  if length(digits) = 11 and left(digits, 1) = '1' then return '+' || digits; end if;
  if left(cleaned, 1) = '+' then return '+' || digits; end if;
  return digits;
end;
$$;

create or replace function public.upsert_ticketing_customer(p_name text, p_email text, p_phone text)
returns uuid language plpgsql security definer set search_path = public as $$
declare customer_uuid uuid; normalized text := lower(trim(p_email)); normalized_phone text;
begin
  if coalesce(trim(p_name), '') = '' or normalized !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'INVALID_BUYER'; end if;
  normalized_phone := public.normalize_ticketing_phone(p_phone);
  insert into public.customers(normalized_email, full_name, email, phone)
  values (normalized, trim(p_name), normalized, normalized_phone)
  on conflict (normalized_email) do update set
    full_name = excluded.full_name, email = excluded.email, phone = excluded.phone,
    last_seen_at = now(), updated_at = now()
  returning id into customer_uuid;
  return customer_uuid;
end;
$$;

create or replace function public.release_expired_ticket_reservations()
returns integer language plpgsql security definer set search_path = public as $$
declare reservation record; released_count integer := 0;
begin
  for reservation in
    select r.id, r.order_id, r.ticket_type_id, r.quantity
    from public.inventory_reservations r
    join public.orders o on o.id = r.order_id
    where r.status = 'active' and r.expires_at <= now() and o.status = 'pending'
      and (o.payment_started_at is null or o.payment_started_at <= now() - interval '10 minutes')
    for update of r skip locked
  loop
    update public.ticket_types set quantity_reserved = greatest(0, quantity_reserved - reservation.quantity)
      where id = reservation.ticket_type_id;
    update public.inventory_reservations set status = 'released' where id = reservation.id and status = 'active';
    update public.orders set status = 'expired', expired_at = coalesce(expired_at, now())
      where id = reservation.order_id and status = 'pending';
    released_count := released_count + 1;
  end loop;
  return released_count;
end;
$$;

create or replace function public.begin_ticket_payment(p_order_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare selected_order public.orders%rowtype; extension timestamptz := now() + interval '5 minutes';
begin
  perform public.release_expired_ticket_reservations();
  select * into selected_order from public.orders where id = p_order_id for update;
  if not found or selected_order.status <> 'pending' or selected_order.reservation_expires_at <= now() then return false; end if;
  update public.orders set payment_started_at = now(), reservation_expires_at = greatest(reservation_expires_at, extension)
    where id = p_order_id;
  update public.inventory_reservations set expires_at = greatest(expires_at, extension)
    where order_id = p_order_id and status = 'active';
  return true;
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
  update public.orders set status = 'failed', payment_failed_at = coalesce(payment_failed_at, now()) where id = p_order_id;
end;
$$;

create or replace function public.finalize_paid_ticket_order(
  p_order_id uuid, p_provider_payment_id text, p_provider_order_id text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare paid_order public.orders%rowtype; item record; ticket_index integer; event_code text; active_quantity integer;
begin
  select * into paid_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if paid_order.status in ('paid','partially_refunded','refunded') then
    return jsonb_build_object('order_id',paid_order.id,'status',paid_order.status,'already_processed',true);
  end if;
  if paid_order.status <> 'pending' then raise exception 'ORDER_NOT_PAYABLE'; end if;
  select upper(substr(regexp_replace(coalesce(slug,title),'[^a-zA-Z0-9]','','g'),1,4)) into event_code from public.events where id=paid_order.event_id;
  for item in select oi.*,tt.name ticket_type_name from public.order_items oi join public.ticket_types tt on tt.id=oi.ticket_type_id where oi.order_id=paid_order.id order by oi.id
  loop
    select quantity into active_quantity from public.inventory_reservations
      where order_id=paid_order.id and ticket_type_id=item.ticket_type_id and status='active' for update;
    if active_quantity is distinct from item.quantity then raise exception 'RESERVATION_NOT_ACTIVE'; end if;
    perform 1 from public.ticket_types where id=item.ticket_type_id for update;
    update public.ticket_types set quantity_reserved=quantity_reserved-item.quantity, quantity_sold=quantity_sold+item.quantity
      where id=item.ticket_type_id and quantity_reserved>=item.quantity and quantity_sold+item.quantity<=quantity_total;
    if not found then raise exception 'INVENTORY_CONVERSION_FAILED'; end if;
    update public.inventory_reservations set status='converted' where order_id=paid_order.id and ticket_type_id=item.ticket_type_id and status='active';
    for ticket_index in 1..item.quantity loop
      insert into public.tickets(order_id,event_id,ticket_type_id,ticket_number,attendee_name,attendee_email)
      values (paid_order.id,paid_order.event_id,item.ticket_type_id,'GOOM-'||coalesce(nullif(event_code,''),'EVT')||'-'||lpad(nextval('public.goom_ticket_number_seq')::text,6,'0'),paid_order.customer_name,paid_order.customer_email)
      on conflict do nothing;
    end loop;
  end loop;
  update public.orders set status='paid',paid_at=coalesce(paid_at,now()),provider_payment_id=coalesce(provider_payment_id,p_provider_payment_id),provider_order_id=coalesce(provider_order_id,p_provider_order_id)
    where id=paid_order.id;
  insert into public.audit_logs(action,entity_type,entity_id,metadata) values ('tickets.created','order',paid_order.id,jsonb_build_object('provider_payment_id',p_provider_payment_id));
  return jsonb_build_object('order_id',paid_order.id,'status','paid','already_processed',false);
end;
$$;

create or replace function public.create_ticket_order(
  p_event_id uuid, p_customer_name text, p_customer_email text, p_customer_phone text,
  p_payment_provider text, p_items jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  selected_event public.events%rowtype; new_order public.orders%rowtype; customer_uuid uuid; item record;
  subtotal integer := 0; fees integer := 0; fee_enabled boolean := false; fee_type text := 'fixed'; fee_value integer := 0;
  chosen_currency text := null; derived_payment_environment text := 'manual'; requested_count integer; matched_count integer;
  requested_quantity integer; expiry timestamptz := now() + interval '15 minutes'; normalized_phone text;
begin
  perform public.release_expired_ticket_reservations();
  normalized_phone := public.normalize_ticketing_phone(p_customer_phone);
  customer_uuid := public.upsert_ticketing_customer(p_customer_name, p_customer_email, normalized_phone);
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_CART'; end if;
  if p_payment_provider not in ('mock','square') then raise exception 'INVALID_PAYMENT_PROVIDER'; end if;
  if p_payment_provider = 'mock' then derived_payment_environment := 'mock';
  elsif p_payment_provider = 'square' then
    select environment into derived_payment_environment from public.payment_connections where provider = 'square' and connected = true;
    if derived_payment_environment is null then raise exception 'PAYMENT_CONNECTION_UNAVAILABLE'; end if;
  end if;

  select * into selected_event from public.events where id = p_event_id for update;
  if not found or selected_event.status <> 'published' or not selected_event.sales_enabled then raise exception 'SALES_DISABLED'; end if;
  select count(*) into requested_count from (select distinct x.ticket_type_id from jsonb_to_recordset(p_items) as x(ticket_type_id uuid, quantity integer) where x.quantity > 0) q;
  select count(*) into matched_count from public.ticket_types tt join
    (select x.ticket_type_id, sum(x.quantity)::integer quantity from jsonb_to_recordset(p_items) as x(ticket_type_id uuid, quantity integer) where x.quantity > 0 group by x.ticket_type_id) q
    on q.ticket_type_id = tt.id where tt.event_id = p_event_id;
  if requested_count = 0 or matched_count <> requested_count then raise exception 'INVALID_TICKET_TYPE'; end if;
  select coalesce(sum(x.quantity),0)::integer into requested_quantity from jsonb_to_recordset(p_items) as x(ticket_type_id uuid, quantity integer) where x.quantity > 0;
  if requested_quantity > 12 then raise exception 'ORDER_LIMIT_EXCEEDED'; end if;
  if selected_event.capacity is not null and ((select coalesce(sum(quantity_sold + quantity_reserved),0) from public.ticket_types where event_id = p_event_id) + requested_quantity > selected_event.capacity) then raise exception 'INSUFFICIENT_EVENT_CAPACITY'; end if;

  insert into public.orders(event_id, customer_id, customer_name, customer_email, customer_phone, payment_provider, payment_environment, reservation_expires_at)
  values (p_event_id, customer_uuid, trim(p_customer_name), lower(trim(p_customer_email)), normalized_phone, p_payment_provider, derived_payment_environment, expiry)
  returning * into new_order;

  for item in select tt.*, q.quantity requested_quantity from public.ticket_types tt join
    (select x.ticket_type_id, sum(x.quantity)::integer quantity from jsonb_to_recordset(p_items) as x(ticket_type_id uuid, quantity integer) where x.quantity > 0 group by x.ticket_type_id) q
    on q.ticket_type_id = tt.id where tt.event_id = p_event_id order by tt.id for update of tt
  loop
    if not item.active or (item.sales_start is not null and item.sales_start > now()) or (item.sales_end is not null and item.sales_end < now()) then raise exception 'TICKET_NOT_ON_SALE'; end if;
    if item.quantity_sold + item.quantity_reserved + item.requested_quantity > item.quantity_total then raise exception 'INSUFFICIENT_INVENTORY'; end if;
    if chosen_currency is null then chosen_currency := item.currency; elsif chosen_currency <> item.currency then raise exception 'MIXED_CURRENCY'; end if;
    subtotal := subtotal + (item.price_cents * item.requested_quantity);
    insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_cents,total_cents) values (new_order.id,item.id,item.requested_quantity,item.price_cents,item.price_cents*item.requested_quantity);
    insert into public.inventory_reservations(order_id,ticket_type_id,quantity,expires_at) values (new_order.id,item.id,item.requested_quantity,expiry);
    update public.ticket_types set quantity_reserved = quantity_reserved + item.requested_quantity where id = item.id;
  end loop;

  if selected_event.use_global_service_fee then
    select coalesce((select value::boolean from public.site_settings where key='service_fee_enabled'),false),
      coalesce((select value from public.site_settings where key='service_fee_type'),'fixed'),
      coalesce((select value::integer from public.site_settings where key='service_fee_value'),0) into fee_enabled,fee_type,fee_value;
  else fee_enabled:=selected_event.service_fee_enabled; fee_type:=selected_event.service_fee_type; fee_value:=selected_event.service_fee_value; end if;
  if fee_value < 0 or (fee_type='percentage' and fee_value>10000) or (fee_type='fixed' and fee_value>10000000) then raise exception 'INVALID_SERVICE_FEE'; end if;
  if fee_enabled then if fee_type='fixed' then fees:=fee_value; elsif fee_type='percentage' then fees:=((subtotal::bigint*fee_value::bigint+5000)/10000)::integer; else raise exception 'INVALID_SERVICE_FEE'; end if; end if;
  update public.orders set subtotal_cents=subtotal,fees_cents=fees,total_cents=subtotal+fees,currency=chosen_currency where id=new_order.id returning * into new_order;
  return jsonb_build_object('id',new_order.id,'public_token',new_order.public_token,'order_number',new_order.order_number,'subtotal_cents',new_order.subtotal_cents,'fees_cents',new_order.fees_cents,'total_cents',new_order.total_cents,'currency',new_order.currency,'expires_at',new_order.reservation_expires_at);
end;
$$;

revoke all on function public.normalize_ticketing_phone(text) from public;
revoke all on function public.upsert_ticketing_customer(text,text,text) from public;
revoke all on function public.begin_ticket_payment(uuid) from public;
revoke all on function public.finalize_paid_ticket_order(uuid,text,text) from public;
revoke all on function public.create_ticket_order(uuid,text,text,text,text,jsonb) from public;
grant execute on function public.create_ticket_order(uuid,text,text,text,text,jsonb) to anon, authenticated;
grant execute on function public.release_expired_ticket_reservations() to service_role;
grant execute on function public.begin_ticket_payment(uuid) to service_role;
grant execute on function public.finalize_paid_ticket_order(uuid,text,text) to service_role;
grant execute on function public.fail_ticket_order(uuid) to service_role;
