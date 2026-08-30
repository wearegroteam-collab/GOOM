import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MockPaymentProvider } from "../lib/payments/mock-provider";
import { buildRefundIdempotencyKey, buildTicketNumber, canReserveInventory, generateVerificationToken, nextOrderStatus, publicAvailabilityStatus } from "../lib/ticketing/core";
import { calculateServiceFeeCents, effectiveServiceFee, parseFixedFeeInput, parsePercentageFeeInput } from "../lib/ticketing/service-fee";
import { isFriendlyPostalCode, normalizePostalCode } from "../lib/payments/postal-code";

test("Canadian postal codes accept compact or spaced input and normalize to uppercase", () => {
  assert.equal(normalizePostalCode("l2r3a6"), "L2R 3A6");
  assert.equal(normalizePostalCode("L2R 3A6"), "L2R 3A6");
  assert.equal(normalizePostalCode("m5v 2t6"), "M5V 2T6");
  assert.equal(normalizePostalCode("90210"), "90210");
  for (const value of ["L2R 3A6", "L2R3A6", "M5V 2T6", "90210", "SW1A 1AA"]) assert.equal(isFriendlyPostalCode(value), true);
  for (const value of ["<>123", "A/123", "12@34"]) assert.equal(isFriendlyPostalCode(value), false);
});

test("disabled service fees leave the ticket subtotal unchanged", () => {
  assert.equal(calculateServiceFeeCents(4000, { enabled: false, type: "fixed", value: 300 }), 0);
});

test("fixed service fees are stored in cents and added once per order", () => {
  const subtotal = 4000;
  const fee = calculateServiceFeeCents(subtotal, { enabled: true, type: "fixed", value: 300 });
  assert.equal(fee, 300);
  assert.equal(subtotal + fee, 4300);
  assert.equal(parseFixedFeeInput("3.00"), 300);
});

test("percentage service fees use basis points and round half up to a cent", () => {
  assert.equal(parsePercentageFeeInput("7.5"), 750);
  assert.equal(parsePercentageFeeInput("100.01"), null);
  assert.equal(calculateServiceFeeCents(4000, { enabled: true, type: "percentage", value: 750 }), 300);
  assert.equal(calculateServiceFeeCents(19, { enabled: true, type: "percentage", value: 750 }), 1);
  assert.equal(calculateServiceFeeCents(20, { enabled: true, type: "percentage", value: 750 }), 2);
});

test("event service fee override replaces the global configuration", () => {
  const globalFee = { enabled: true, type: "fixed" as const, value: 300 };
  assert.deepEqual(effectiveServiceFee({ use_global_service_fee: true }, globalFee), globalFee);
  assert.deepEqual(effectiveServiceFee({ use_global_service_fee: false, service_fee_enabled: true, service_fee_type: "percentage", service_fee_value: 500 }, globalFee), { enabled: true, type: "percentage", value: 500 });
});

test("ticket generation creates readable numbers and cryptographic tokens", () => {
  assert.equal(buildTicketNumber("michel-torres", 124), "GOOM-MICH-000124");
  assert.match(generateVerificationToken(), /^[a-f0-9]{64}$/);
});

test("verification tokens are unique", () => {
  const tokens = new Set(Array.from({ length: 2000 }, generateVerificationToken));
  assert.equal(tokens.size, 2000);
});

test("inventory limit includes sold and temporarily reserved tickets", () => {
  assert.equal(canReserveInventory(200, 84, 15, 101), true);
  assert.equal(canReserveInventory(200, 84, 15, 102), false);
});

test("duplicate payment confirmation is idempotent at status level", () => {
  assert.equal(nextOrderStatus("pending", "payment_completed"), "paid");
  assert.equal(nextOrderStatus("paid", "payment_completed"), "paid");
});

test("failed payment never becomes paid without a new pending order", () => {
  assert.equal(nextOrderStatus("pending", "payment_failed"), "failed");
  assert.equal(nextOrderStatus("failed", "payment_completed"), "failed");
});

test("double check-in invariant allows only active to become used", () => {
  const checkIn = (status: string) => status === "active" ? "used" : status;
  assert.equal(checkIn("active"), "used");
  assert.equal(checkIn(checkIn("active")), "used");
  assert.equal(checkIn("refunded"), "refunded");
});

test("full mock refunds return the ticket subtotal plus service fee", async () => {
  const previous = process.env.PAYMENT_PROVIDER;
  process.env.PAYMENT_PROVIDER = "mock";
  try {
    const subtotalCents = 4000;
    const feesCents = 300;
    const result = await new MockPaymentProvider().refundPayment({ paymentId: "mock-payment", amountCents: subtotalCents + feesCents, currency: "CAD", idempotencyKey: "same-key" });
    assert.deepEqual(result, { providerRefundId: "mock_refund_same-key", status: "completed" });
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_PROVIDER; else process.env.PAYMENT_PROVIDER = previous;
  }
});

test("Square charge and full refund flows use the persisted order total", () => {
  const chargeRoute = readFileSync("app/api/payments/charge/route.ts", "utf8");
  const refundAction = readFileSync("app/admin/(protected)/orders/actions.ts", "utf8");
  assert.match(chargeRoute, /amountCents:\s*order\.total_cents/);
  assert.match(refundAction, /refundPayment\(\{[\s\S]*?amountCents:\s*order\.total_cents/);
});

test("test-data reset is explicitly guarded and never deletes payment connections", () => {
  const resetSql = readFileSync("scripts/reset-test-ticketing-data.sql", "utf8");
  assert.match(resetSql, /app\.allow_test_data_reset/);
  assert.match(resetSql, /app\.test_data_reset_scope/);
  assert.match(resetSql, /app\.expected_test_order_count/);
  assert.match(resetSql, /payment_environment not in \('mock','sandbox'\)/);
  assert.match(resetSql, /setval\('public\.goom_order_number_seq', 1, false\)/);
  assert.match(resetSql, /setval\('public\.goom_ticket_number_seq', 1, false\)/);
  assert.doesNotMatch(resetSql, /delete from public\.payment_connections/i);
});

test("payment environment migration preserves the six-parameter ticket order RPC", () => {
  const migration = readFileSync("supabase/migrations/202608300005_ticketing_payment_environment.sql", "utf8");
  const orderRoute = readFileSync("app/api/ticketing/orders/route.ts", "utf8");

  assert.match(migration, /create or replace function public\.create_ticket_order\(\s*p_event_id uuid,\s*p_customer_name text,\s*p_customer_email text,\s*p_customer_phone text,\s*p_payment_provider text,\s*p_items jsonb\s*\)/);
  assert.match(migration, /revoke all on function public\.create_ticket_order\(uuid,text,text,text,text,jsonb\) from public/);
  assert.match(migration, /grant execute on function public\.create_ticket_order\(uuid,text,text,text,text,jsonb\) to anon, authenticated/);
  assert.doesNotMatch(migration, /create_ticket_order\(uuid,text,text,text,text,text,jsonb\)/);
  assert.doesNotMatch(migration, /p_payment_environment/);
  assert.match(migration, /from public\.payment_connections\s+where provider = 'square'/);
  assert.match(migration, /payment_provider, payment_environment, reservation_expires_at/);
  assert.doesNotMatch(orderRoute, /p_payment_environment/);
});

test("refund idempotency key is stable per order", () => {
  assert.equal(buildRefundIdempotencyKey("order-1"), buildRefundIdempotencyKey("order-1"));
  assert.notEqual(buildRefundIdempotencyKey("order-1"), buildRefundIdempotencyKey("order-2"));
});

test("automatic availability uses real inventory thresholds", () => {
  assert.equal(publicAvailabilityStatus({ quantity_total: 100, quantity_sold: 69, quantity_reserved: 0 }), "available");
  assert.equal(publicAvailabilityStatus({ quantity_total: 100, quantity_sold: 70, quantity_reserved: 0 }), "selling_fast");
  assert.equal(publicAvailabilityStatus({ quantity_total: 100, quantity_sold: 89, quantity_reserved: 0 }), "selling_fast");
  assert.equal(publicAvailabilityStatus({ quantity_total: 100, quantity_sold: 90, quantity_reserved: 0 }), "last_tickets");
  assert.equal(publicAvailabilityStatus({ quantity_total: 100, quantity_sold: 100, quantity_reserved: 0 }), "sold_out");
});

test("manual availability labels do not mutate inventory", () => {
  const ticket = { quantity_total: 100, quantity_sold: 40, quantity_reserved: 5 };
  for (const status of ["available", "selling_fast", "last_tickets", "sold_out", "hidden"] as const) {
    const snapshot = { ...ticket };
    assert.equal(publicAvailabilityStatus({ ...ticket, public_availability_status: status }), status);
    assert.deepEqual(ticket, snapshot);
  }
});

test("real zero inventory overrides commercial labels", () => {
  for (const status of ["automatic", "available", "selling_fast", "last_tickets"] as const) {
    assert.equal(publicAvailabilityStatus({ quantity_total: 100, quantity_sold: 98, quantity_reserved: 2, public_availability_status: status }), "sold_out");
  }
});
