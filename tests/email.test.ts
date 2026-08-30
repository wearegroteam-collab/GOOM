import assert from "node:assert/strict";
import test from "node:test";
import { automaticDeliveryKey, deliverTransactionalEmail, retryDeliveryKey, type DeliveryStore } from "../lib/email/delivery";
import { formatEventDateTime } from "../lib/email/format";
import { ResendEmailProvider } from "../lib/email/resend-provider";
import { renderComplimentaryEmail, renderRefundConfirmedEmail, renderTicketsReadyEmail } from "../lib/email/templates";
import type { EmailProvider } from "../lib/email/email-provider";

const branding = { siteUrl: "https://goom.example", logoUrl: "https://goom.example/images/goom-logo.png" };
const event = { name: "Michel Torres", date: "2026-10-30T20:00:00-04:00", venue: "Columbus Club", address: "6990 Stanley Avenue", city: "Niagara Falls" };
const tickets = [
  { ticketNumber: "GOOM-MICH-000001", ticketType: "Pre-venta", attendeeName: "Alex Morgan", url: "https://goom.example/tickets/one" },
  { ticketNumber: "GOOM-MICH-000002", ticketType: "Pre-venta", attendeeName: "Alex Morgan", url: "https://goom.example/tickets/two" },
];

test("ticket email renders a human date and every ticket", () => {
  const rendered = renderTicketsReadyEmail({ branding, customerName: "Alex Morgan", orderNumber: "GOOM-ORD-000004", event, tickets, orderUrl: "https://goom.example/checkout/order", amounts: { subtotalCents: 8000, feesCents: 0, totalCents: 8000, currency: "CAD", paymentProvider: "square" } });
  assert.equal(rendered.subject, "Your tickets for Michel Torres — GOOM-ORD-000004");
  assert.match(rendered.html, /Friday, October 30, 2026/);
  assert.doesNotMatch(rendered.html, /2026-10-30T20:00/);
  assert.match(rendered.html, /GOOM-MICH-000001/);
  assert.match(rendered.html, /GOOM-MICH-000002/);
  assert.equal((rendered.html.match(/VIEW TICKET &amp; QR/g) || []).length, 2);
});

test("event time uses the configured Niagara timezone", () => {
  const formatted = formatEventDateTime("2026-10-31T00:00:00Z", "America/Toronto");
  assert.equal(formatted.date, "Friday, October 30, 2026");
  assert.equal(formatted.time, "8:00 PM");
});

test("refund template identifies affected tickets and invalidates them", () => {
  const rendered = renderRefundConfirmedEmail({ branding, customerName: "Alex Morgan", orderNumber: "GOOM-ORD-000004", event, refundAmountCents: 8000, currency: "CAD", ticketNumbers: tickets.map((ticket) => ticket.ticketNumber), orderUrl: "https://goom.example/checkout/order" });
  assert.equal(rendered.subject, "Refund confirmed — GOOM-ORD-000004");
  assert.match(rendered.html, /The refunded tickets are no longer valid for entry/);
  assert.match(rendered.html, /GOOM-MICH-000002/);
});

test("complimentary template feels like an invitation without payment language", () => {
  const rendered = renderComplimentaryEmail({ branding, customerName: "Alex Morgan", event, tickets: [tickets[0]], orderUrl: "https://goom.example/checkout/order" });
  assert.match(rendered.subject, /Your complimentary ticket/);
  assert.match(rendered.html, /received a complimentary ticket/);
  assert.doesNotMatch(rendered.html, /\$0|Payment confirmed|payment provider/i);
});

test("Resend failure is surfaced without exposing credentials", async () => {
  const provider = new ResendEmailProvider({ apiKey: "secret", from: "GOOM <tickets@example.com>", fetchImplementation: async () => new Response("temporary outage", { status: 503 }) });
  await assert.rejects(() => provider.send({ to: "guest@example.com", subject: "Test", html: "<p>Test</p>", idempotencyKey: "test:one" }), /temporary outage/);
});

function memoryDeliveryStore() {
  const keys = new Set<string>();
  const failed: string[] = [];
  const sent: string[] = [];
  const store: DeliveryStore = {
    async create(input) { if (keys.has(input.idempotencyKey)) return null; keys.add(input.idempotencyKey); return { id: input.idempotencyKey }; },
    async markSent(id) { sent.push(id); },
    async markFailed(id) { failed.push(id); },
  };
  return { store, failed, sent };
}

test("stable automatic key prevents duplicate email work", async () => {
  const memory = memoryDeliveryStore();
  let sends = 0;
  const provider: EmailProvider = { async send() { sends += 1; return { messageId: "message" }; } };
  const input = { store: memory.store, provider, orderId: "order-1", type: "tickets_ready" as const, recipient: "guest@example.com", message: { subject: "Tickets", html: "<p>Tickets</p>" }, idempotencyKey: automaticDeliveryKey("tickets_ready", "order-1") };
  assert.equal((await deliverTransactionalEmail(input)).status, "sent");
  assert.equal((await deliverTransactionalEmail(input)).status, "skipped");
  assert.equal(sends, 1);
});

test("provider failure is recorded and never thrown into the order flow", async () => {
  const memory = memoryDeliveryStore();
  const provider: EmailProvider = { async send() { throw new Error("Resend unavailable"); } };
  const result = await deliverTransactionalEmail({ store: memory.store, provider, orderId: "order-2", type: "tickets_ready", recipient: "guest@example.com", message: { subject: "Tickets", html: "<p>Tickets</p>" }, idempotencyKey: automaticDeliveryKey("tickets_ready", "order-2") });
  assert.equal(result.status, "failed");
  assert.equal(memory.failed.length, 1);
});

test("manual resend creates a controlled new attempt without ticket generation", async () => {
  const memory = memoryDeliveryStore();
  let sends = 0;
  const generatedTickets = 0;
  const provider: EmailProvider = { async send() { sends += 1; return { messageId: `message-${sends}` }; } };
  const baseKey = automaticDeliveryKey("tickets_ready", "order-3");
  const common = { store: memory.store, provider, orderId: "order-3", type: "tickets_ready" as const, recipient: "guest@example.com", message: { subject: "Tickets", html: "<p>Existing tickets only</p>" } };
  await deliverTransactionalEmail({ ...common, idempotencyKey: baseKey });
  await deliverTransactionalEmail({ ...common, idempotencyKey: retryDeliveryKey(baseKey, "manual-attempt") });
  assert.equal(sends, 2);
  assert.equal(generatedTickets, 0);
});
