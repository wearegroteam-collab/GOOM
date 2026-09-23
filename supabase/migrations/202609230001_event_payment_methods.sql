-- Add per-event payment methods and a manually approved e-Transfer flow.
-- Existing card/Square behavior remains enabled for every existing event.

alter table public.events
  add column if not exists card_payments_enabled boolean not null default true,
  add column if not exists etransfer_payments_enabled boolean not null default false;

alter table public.orders
  add column if not exists etransfer_submitted_at timestamptz,
  add column if not exists etransfer_approved_at timestamptz,
  add column if not exists etransfer_approved_by uuid references auth.users(id) on delete set null;

insert into public.site_settings(key, value)
select 'etransfer_email', coalesce((select value from public.site_settings where key = 'email'), '')
where not exists (select 1 from public.site_settings where key = 'etransfer_email');

insert into public.site_settings(key, value)
select 'etransfer_whatsapp', coalesce((select value from public.site_settings where key = 'whatsapp'), '')
where not exists (select 1 from public.site_settings where key = 'etransfer_whatsapp');

create index if not exists orders_pending_etransfer_idx
  on public.orders(created_at desc)
  where payment_provider = 'etransfer' and status = 'pending';

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
  if p_payment_provider not in ('mock','square','etransfer') then raise exception 'INVALID_PAYMENT_PROVIDER'; end if;
  if p_payment_provider = 'mock' then derived_payment_environment := 'mock';
  elsif p_payment_provider = 'square' then
    select environment into derived_payment_environment from public.payment_connections where provider = 'square' and connected = true;
    if derived_payment_environment is null then raise exception 'PAYMENT_CONNECTION_UNAVAILABLE'; end if;
  else
    derived_payment_environment := 'manual';
    expiry := now() + interval '24 hours';
  end if;

  select * into selected_event from public.events where id = p_event_id for update;
  if not found or selected_event.status <> 'published' or not selected_event.sales_enabled then raise exception 'SALES_DISABLED'; end if;
  if p_payment_provider in ('mock','square') and not selected_event.card_payments_enabled then raise exception 'PAYMENT_METHOD_DISABLED'; end if;
  if p_payment_provider = 'etransfer' and not selected_event.etransfer_payments_enabled then raise exception 'PAYMENT_METHOD_DISABLED'; end if;
  select count(*) into requested_count from (select distinct x.ticket_type_id from jsonb_to_recordset(p_items) as x(ticket_type_id uuid, quantity integer) where x.quantity > 0) q;
  select count(*) into matched_count from public.ticket_types tt join
    (select x.ticket_type_id, sum(x.quantity)::integer quantity from jsonb_to_recordset(p_items) as x(ticket_type_id uuid, quantity integer) where x.quantity > 0 group by x.ticket_type_id) q
    on q.ticket_type_id = tt.id where tt.event_id = p_event_id;
  if requested_count = 0 or matched_count <> requested_count then raise exception 'INVALID_TICKET_TYPE'; end if;
  select coalesce(sum(x.quantity),0)::integer into requested_quantity from jsonb_to_recordset(p_items) as x(ticket_type_id uuid, quantity integer) where x.quantity > 0;
  if requested_quantity > 12 then raise exception 'ORDER_LIMIT_EXCEEDED'; end if;
  if selected_event.capacity is not null and ((select coalesce(sum(quantity_sold + quantity_reserved),0) from public.ticket_types where event_id = p_event_id) + requested_quantity > selected_event.capacity) then raise exception 'INSUFFICIENT_EVENT_CAPACITY'; end if;

  insert into public.orders(event_id, customer_id, customer_name, customer_email, customer_phone, payment_provider, payment_environment, reservation_expires_at, etransfer_submitted_at)
  values (p_event_id, customer_uuid, trim(p_customer_name), lower(trim(p_customer_email)), normalized_phone, p_payment_provider, derived_payment_environment, expiry, case when p_payment_provider = 'etransfer' then now() else null end)
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

create or replace function public.approve_etransfer_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  selected_order public.orders%rowtype;
  result jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  perform public.release_expired_ticket_reservations();
  select * into selected_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if selected_order.payment_provider <> 'etransfer' then raise exception 'NOT_ETRANSFER_ORDER'; end if;
  if selected_order.status = 'paid' then
    return jsonb_build_object('order_id', selected_order.id, 'status', selected_order.status, 'already_processed', true);
  end if;
  if selected_order.status <> 'pending' or selected_order.reservation_expires_at <= now() then raise exception 'ORDER_NOT_PAYABLE'; end if;

  result := public.finalize_paid_ticket_order(selected_order.id, 'etransfer-' || selected_order.id::text, null);
  update public.orders set etransfer_approved_at = coalesce(etransfer_approved_at, now()), etransfer_approved_by = coalesce(etransfer_approved_by, auth.uid()) where id = selected_order.id;
  insert into public.audit_logs(action, entity_type, entity_id, user_id, metadata)
  values ('etransfer.approved', 'order', selected_order.id, auth.uid(), jsonb_build_object('order_number', selected_order.order_number, 'total_cents', selected_order.total_cents, 'currency', selected_order.currency));
  return result;
end;
$$;

revoke all on function public.create_ticket_order(uuid,text,text,text,text,jsonb) from public;
grant execute on function public.create_ticket_order(uuid,text,text,text,text,jsonb) to anon, authenticated;
revoke all on function public.approve_etransfer_order(uuid) from public;
grant execute on function public.approve_etransfer_order(uuid) to authenticated;
