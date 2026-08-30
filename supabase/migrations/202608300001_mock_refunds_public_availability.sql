-- Reliable mock refunds and administrable public ticket availability.
-- Existing ticket types remain automatic and keep their real inventory.

alter table public.ticket_types
  add column if not exists public_availability_status text not null default 'automatic';

update public.ticket_types
set public_availability_status = 'automatic'
where public_availability_status is null;

alter table public.ticket_types
  drop constraint if exists ticket_types_public_availability_status_check;

alter table public.ticket_types
  add constraint ticket_types_public_availability_status_check
  check (public_availability_status in ('automatic','available','selling_fast','last_tickets','sold_out','hidden'));

comment on column public.ticket_types.public_availability_status is
  'Commercial public label only. Real availability remains quantity_total - quantity_sold - quantity_reserved.';

-- Public sale orders cannot reserve types deliberately hidden or manually sold out.
-- Complimentary/admin tickets remain possible and real inventory checks still apply.
create or replace function public.enforce_public_ticket_availability()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  selected_status text;
  selected_payment_type text;
begin
  select public_availability_status into selected_status
  from public.ticket_types
  where id = new.ticket_type_id;

  select payment_type into selected_payment_type
  from public.orders
  where id = new.order_id;

  if selected_payment_type = 'sale' and selected_status in ('sold_out', 'hidden') then
    raise exception 'TICKET_NOT_ON_SALE';
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_reservations_public_availability on public.inventory_reservations;
create trigger inventory_reservations_public_availability
before insert on public.inventory_reservations
for each row execute function public.enforce_public_ticket_availability();

-- Finalization owns the transition to completed. Calling it repeatedly is safe:
-- inventory, ticket status and audit are changed exactly once.
create or replace function public.finalize_ticket_refund(p_provider_refund_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  selected_refund public.refunds%rowtype;
  selected_order public.orders%rowtype;
  item record;
  new_refunded integer;
  full_refund boolean;
begin
  select * into selected_refund
  from public.refunds
  where provider_refund_id = p_provider_refund_id
  for update;

  if not found then raise exception 'REFUND_NOT_FOUND'; end if;
  if selected_refund.status = 'completed' then
    return jsonb_build_object('status','completed','already_processed',true);
  end if;

  select * into selected_order
  from public.orders
  where id = selected_refund.order_id
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if selected_order.status = 'refunded' then
    update public.refunds set status = 'completed', completed_at = coalesce(completed_at, now()) where id = selected_refund.id;
    return jsonb_build_object('status','refunded','already_processed',true);
  end if;
  if selected_order.status not in ('paid','partially_refunded') then raise exception 'ORDER_NOT_REFUNDABLE'; end if;

  new_refunded := least(selected_order.total_cents, selected_order.refunded_cents + selected_refund.amount_cents);
  full_refund := new_refunded >= selected_order.total_cents;

  update public.refunds
  set status = 'completed', completed_at = now()
  where id = selected_refund.id;

  update public.orders
  set refunded_cents = new_refunded,
      status = case when full_refund then 'refunded' else 'partially_refunded' end,
      refunded_at = case when full_refund then now() else refunded_at end
  where id = selected_order.id;

  if full_refund then
    for item in
      select ticket_type_id, quantity
      from public.order_items
      where order_id = selected_order.id
    loop
      update public.ticket_types
      set quantity_sold = greatest(0, quantity_sold - item.quantity)
      where id = item.ticket_type_id;
    end loop;

    update public.tickets
    set status = 'refunded'
    where order_id = selected_order.id and status = 'active';
  end if;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  values (selected_refund.created_by, 'order.refunded', 'order', selected_order.id,
    jsonb_build_object('amount_cents', selected_refund.amount_cents, 'provider_refund_id', p_provider_refund_id));

  return jsonb_build_object(
    'status', case when full_refund then 'refunded' else 'partially_refunded' end,
    'already_processed', false
  );
end;
$$;

drop policy if exists "Public reads ticket types on sale" on public.ticket_types;
create policy "Public reads ticket types on sale" on public.ticket_types
for select to anon, authenticated using (
  active
  and public_availability_status <> 'hidden'
  and exists (
    select 1 from public.events e
    where e.id = event_id and e.status = 'published' and e.sales_enabled
  )
);

revoke all on function public.enforce_public_ticket_availability() from public;
revoke all on function public.finalize_ticket_refund(text) from public;
grant execute on function public.finalize_ticket_refund(text) to service_role;
