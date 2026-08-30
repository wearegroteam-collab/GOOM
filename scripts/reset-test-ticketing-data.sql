-- GOOM TEST TICKETING RESET - DO NOT RUN AS PART OF MIGRATIONS.
--
-- This script intentionally does not contain the confirmation commands.
-- In the SAME database session, a database owner must first run:
--   select payment_environment, count(*) from public.orders group by payment_environment;
--   set app.allow_test_data_reset = 'true';
--   set app.test_data_reset_scope = 'mock+sandbox';
--   set app.expected_test_order_count = '<the exact mock+sandbox order count shown above>';
-- Then execute this file. Missing confirmations abort the transaction.

begin;

do $$
begin
  if current_setting('app.allow_test_data_reset', true) is distinct from 'true'
    or current_setting('app.test_data_reset_scope', true) is distinct from 'mock+sandbox'
    or current_setting('app.expected_test_order_count', true) is null then
    raise exception 'RESET_ABORTED: explicit mock+sandbox confirmation is required';
  end if;

  if current_setting('app.expected_test_order_count', true) !~ '^\d+$'
    or current_setting('app.expected_test_order_count', true)::bigint <> (
      select count(*) from public.orders where payment_environment in ('mock','sandbox')
    ) then
    raise exception 'RESET_ABORTED: expected test order count does not match the current database';
  end if;

  if exists (
    select 1 from public.orders
    where payment_environment not in ('mock','sandbox')
  ) then
    raise exception 'RESET_ABORTED: production or manual orders exist; sequences and counters must not be reset';
  end if;
end;
$$;

create temporary table _goom_reset_orders on commit drop as
select id from public.orders where payment_environment in ('mock','sandbox');

create temporary table _goom_reset_tickets on commit drop as
select id from public.tickets where order_id in (select id from _goom_reset_orders);

create temporary table _goom_reset_refunds on commit drop as
select id from public.refunds where order_id in (select id from _goom_reset_orders);

-- Preview counts are returned by the SQL client before deletion completes.
select
  (select count(*) from _goom_reset_orders) as orders_to_delete,
  (select count(*) from _goom_reset_tickets) as tickets_to_delete,
  (select count(*) from _goom_reset_refunds) as refunds_to_delete,
  (select count(*) from public.ticket_scans) as scans_to_delete,
  (select count(*) from public.email_deliveries where order_id in (select id from _goom_reset_orders)) as email_deliveries_to_delete,
  (select count(*) from public.payment_webhook_events where environment = 'sandbox') as sandbox_webhooks_to_delete;

delete from public.ticket_scans;
delete from public.tickets where id in (select id from _goom_reset_tickets);
delete from public.refunds where id in (select id from _goom_reset_refunds);
delete from public.email_deliveries where order_id in (select id from _goom_reset_orders);
delete from public.payment_webhook_events where environment = 'sandbox';
delete from public.inventory_reservations where order_id in (select id from _goom_reset_orders);
delete from public.order_items where order_id in (select id from _goom_reset_orders);
delete from public.orders where id in (select id from _goom_reset_orders);
delete from public.audit_logs
where entity_id in (select id from _goom_reset_orders)
   or entity_id in (select id from _goom_reset_tickets)
   or entity_id in (select id from _goom_reset_refunds)
   or action in ('tickets.created','tickets.complimentary','ticket.checked_in','order.refunded');

update public.ticket_types set quantity_sold = 0, quantity_reserved = 0;

select setval('public.goom_order_number_seq', 1, false);
select setval('public.goom_ticket_number_seq', 1, false);

commit;
