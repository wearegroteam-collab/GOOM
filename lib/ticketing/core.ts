import { createHash, randomBytes, randomUUID } from "node:crypto";

export const RESERVATION_MINUTES = 15;
export const MAX_TICKETS_PER_ORDER = 12;

export function money(cents: number, currency = "CAD", locale = "en-CA") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

export function normalizeTicketValue(value: string) {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/tickets\/([^/]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : trimmed;
  } catch { return trimmed; }
}

export function buildPaymentIdempotencyKey(orderId: string) {
  return `goom-pay-${orderId}`.slice(0, 45);
}

export function buildRefundIdempotencyKey(orderId: string) {
  return `goom-ref-${createHash("sha256").update(`${orderId}:${randomUUID()}`).digest("hex")}`.slice(0, 45);
}

export function validateCart(items: Array<{ ticketTypeId: string; quantity: number }>) {
  const valid = items.filter((item) => item.ticketTypeId && Number.isInteger(item.quantity) && item.quantity > 0);
  const quantity = valid.reduce((sum, item) => sum + item.quantity, 0);
  if (!valid.length || quantity > MAX_TICKETS_PER_ORDER) throw new Error("INVALID_CART");
  return valid;
}

export function generateVerificationToken() { return randomBytes(32).toString("hex"); }
export function buildTicketNumber(eventCode: string, sequence: number) { return `GOOM-${eventCode.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0,4) || "EVT"}-${String(sequence).padStart(6,"0")}`; }
export function canReserveInventory(total: number, sold: number, reserved: number, requested: number) { return requested > 0 && sold + reserved + requested <= total; }
export function nextOrderStatus(current: string, signal: "payment_completed"|"payment_failed"|"refund_completed") { if (signal === "payment_completed" && current === "pending") return "paid"; if (signal === "payment_failed" && current === "pending") return "failed"; if (signal === "refund_completed" && (current === "paid" || current === "partially_refunded")) return "refunded"; return current; }
