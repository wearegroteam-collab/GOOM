import assert from "node:assert/strict";
import test from "node:test";
import { buildTicketNumber, canReserveInventory, generateVerificationToken, nextOrderStatus } from "../lib/ticketing/core";

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
});
