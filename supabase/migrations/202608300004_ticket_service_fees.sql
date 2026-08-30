alter table public.events
  add column if not exists use_global_service_fee boolean not null default true,
  add column if not exists service_fee_enabled boolean not null default false,
  add column if not exists service_fee_type text not null default 'fixed',
  add column if not exists service_fee_value integer not null default 0;

alter table public.events drop constraint if exists events_service_fee_type_check;
alter table public.events add constraint events_service_fee_type_check
  check (service_fee_type in ('fixed', 'percentage'));
alter table public.events drop constraint if exists events_service_fee_value_check;
alter table public.events add constraint events_service_fee_value_check
  check (service_fee_value >= 0 and ((service_fee_type = 'percentage' and service_fee_value <= 10000) or (service_fee_type = 'fixed' and service_fee_value <= 10000000)));

insert into public.site_settings (key, value) values
  ('service_fee_enabled', 'false'),
  ('service_fee_type', 'fixed'),
  ('service_fee_value', '0')
on conflict (key) do nothing;

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
  fees integer := 0;
  fee_enabled boolean := false;
  fee_type text := 'fixed';
  fee_value integer := 0;
  chosen_currency text := null;
  requested_count integer;
  matched_count integer;
  requested_quantity integer;
  expiry timestamptz := now() + interval '15 minutes';
begin
  perform public.release_expired_ticket_reservations();
  if coalesce(trim(p_customer_name), '') = '' or p_customer_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'INVALID_BUYER'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_CART'; end if;
  if p_payment_provider not in ('mock','square') then raise exception 'INVALID_PAYMENT_PROVIDER'; end if;

  select * into selected_event from public.events where id = p_event_id for update;
  if not found or selected_event.status <> 'published' or not selected_event.sales_enabled then raise exception 'SALES_DISABLED'; end if;

  select count(*) into requested_count from (
    select distinct x.ticket_type_id from jsonb_to_recordset(p_items) as x(ticket_type_id uuid, quantity integer) where x.quantity > 0
  ) q;
  select count(*) into matched_count from public.ticket_types tt
    join (select x.ticket_type_id, sum(x.quantity)::integer quantity from jsonb_to_recordset(p_items) as x(ticket_type_id uuid, quantity integer) where x.quantity > 0 group by x.ticket_type_id) q on q.ticket_type_id = tt.id
    where tt.event_id = p_event_id;
  if requested_count = 0 or matched_count <> requested_count then raise exception 'INVALID_TICKET_TYPE'; end if;
  select coalesce(sum(x.quantity),0)::integer into requested_quantity from jsonb_to_recordset(p_items) as x(ticket_type_id uuid, quantity integer) where x.quantity > 0;
  if requested_quantity > 12 then raise exception 'ORDER_LIMIT_EXCEEDED'; end if;
  if selected_event.capacity is not null and ((select coalesce(sum(quantity_sold + quantity_reserved),0) from public.ticket_types where event_id = p_event_id) + requested_quantity > selected_event.capacity) then raise exception 'INSUFFICIENT_EVENT_CAPACITY'; end if;

  insert into public.orders(event_id, customer_name, customer_email, customer_phone, payment_provider, reservation_expires_at)
  values (p_event_id, trim(p_customer_name), lower(trim(p_customer_email)), nullif(trim(p_customer_phone), ''), p_payment_provider, expiry)
  returning * into new_order;

  for item in
    select tt.*, q.quantity requested_quantity from public.ticket_types tt
    join (select x.ticket_type_id, sum(x.quantity)::integer quantity from jsonb_to_recordset(p_items) as x(ticket_type_id uuid, quantity integer) where x.quantity > 0 group by x.ticket_type_id) q on q.ticket_type_id = tt.id
    where tt.event_id = p_event_id order by tt.id for update of tt
  loop
    if not item.active or (item.sales_start is not null and item.sales_start > now()) or (item.sales_end is not null and item.sales_end < now()) then raise exception 'TICKET_NOT_ON_SALE'; end if;
    if item.quantity_sold + item.quantity_reserved + item.requested_quantity > item.quantity_total then raise exception 'INSUFFICIENT_INVENTORY'; end if;
    if chosen_currency is null then chosen_currency := item.currency; elsif chosen_currency <> item.currency then raise exception 'MIXED_CURRENCY'; end if;
    subtotal := subtotal + (item.price_cents * item.requested_quantity);
    insert into public.order_items(order_id, ticket_type_id, quantity, unit_price_cents, total_cents) values (new_order.id, item.id, item.requested_quantity, item.price_cents, item.price_cents * item.requested_quantity);
    insert into public.inventory_reservations(order_id, ticket_type_id, quantity, expires_at) values (new_order.id, item.id, item.requested_quantity, expiry);
    update public.ticket_types set quantity_reserved = quantity_reserved + item.requested_quantity where id = item.id;
  end loop;

  if selected_event.use_global_service_fee then
    select coalesce((select value::boolean from public.site_settings where key = 'service_fee_enabled'), false),
           coalesce((select value from public.site_settings where key = 'service_fee_type'), 'fixed'),
           coalesce((select value::integer from public.site_settings where key = 'service_fee_value'), 0)
      into fee_enabled, fee_type, fee_value;
  else
    fee_enabled := selected_event.service_fee_enabled;
    fee_type := selected_event.service_fee_type;
    fee_value := selected_event.service_fee_value;
  end if;

  if fee_value < 0 or (fee_type = 'percentage' and fee_value > 10000) or (fee_type = 'fixed' and fee_value > 10000000) then
    raise exception 'INVALID_SERVICE_FEE';
  end if;

  if fee_enabled then
    if fee_type = 'fixed' then
      fees := fee_value;
    elsif fee_type = 'percentage' then
      fees := ((subtotal::bigint * fee_value::bigint + 5000) / 10000)::integer;
    else
      raise exception 'INVALID_SERVICE_FEE';
    end if;
  end if;

  update public.orders set subtotal_cents = subtotal, fees_cents = fees, total_cents = subtotal + fees, currency = chosen_currency where id = new_order.id returning * into new_order;
  return jsonb_build_object('id', new_order.id, 'public_token', new_order.public_token, 'order_number', new_order.order_number, 'subtotal_cents', new_order.subtotal_cents, 'fees_cents', new_order.fees_cents, 'total_cents', new_order.total_cents, 'currency', new_order.currency, 'expires_at', new_order.reservation_expires_at);
end;
$$;

revoke all on function public.create_ticket_order(uuid,text,text,text,text,jsonb) from public;
grant execute on function public.create_ticket_order(uuid,text,text,text,text,jsonb) to anon, authenticated;
