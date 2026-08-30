-- Professional transactional email history, idempotency and controlled retries.

alter table public.email_deliveries
  add column if not exists type text,
  add column if not exists recipient text,
  add column if not exists provider text not null default 'resend',
  add column if not exists error text,
  add column if not exists idempotency_key text,
  add column if not exists attempt_number integer not null default 1,
  add column if not exists refund_id uuid references public.refunds(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.email_deliveries delivery
set type = case
      when delivery.template = 'tickets' and orders.payment_type = 'complimentary' then 'complimentary'
      when delivery.template = 'tickets' then 'tickets_ready'
      else delivery.template
    end,
    recipient = orders.customer_email,
    error = delivery.last_error,
    idempotency_key = case
      when delivery.template = 'tickets' and orders.payment_type = 'complimentary' then 'complimentary:' || orders.id::text
      when delivery.template = 'tickets' then 'order_paid:' || orders.id::text
      else 'legacy:' || delivery.id::text
    end
from public.orders orders
where orders.id = delivery.order_id
  and (delivery.type is null or delivery.recipient is null or delivery.idempotency_key is null);

alter table public.email_deliveries
  alter column type set not null,
  alter column recipient set not null,
  alter column idempotency_key set not null;

alter table public.email_deliveries
  drop constraint if exists email_deliveries_order_id_template_key;

alter table public.email_deliveries
  drop constraint if exists email_deliveries_type_check;

alter table public.email_deliveries
  add constraint email_deliveries_type_check
  check (type in ('tickets_ready','refund_confirmed','complimentary','event_reminder','event_update'));

create unique index if not exists email_deliveries_idempotency_key_idx
  on public.email_deliveries(idempotency_key);

create index if not exists email_deliveries_order_type_created_idx
  on public.email_deliveries(order_id, type, created_at desc);

comment on column public.email_deliveries.idempotency_key is
  'Logical send attempt key. Automatic sends use a stable key; manual retries use a new controlled attempt key.';
