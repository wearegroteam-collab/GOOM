import assert from "node:assert/strict";
import test from "node:test";
import { MockPaymentProvider } from "../lib/payments/mock-provider";
import { buildRefundIdempotencyKey, buildTicketNumber, canReserveInventory, generateVerificationToken, nextOrderStatus, publicAvailabilityStatus } from "../lib/ticketing/core";

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

test("mock refunds complete without contacting Square", async () => {
  const previous = process.env.PAYMENT_PROVIDER;
  process.env.PAYMENT_PROVIDER = "mock";
  try {
    const result = await new MockPaymentProvider().refundPayment({ paymentId: "mock-payment", amountCents: 4000, currency: "CAD", idempotencyKey: "same-key" });
    assert.deepEqual(result, { providerRefundId: "mock_refund_same-key", status: "completed" });
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_PROVIDER; else process.env.PAYMENT_PROVIDER = previous;
  }
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
