export type CustomerOrderStatus =
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export type CustomerOrderSummary = {
  status: CustomerOrderStatus;
  total_cents: number;
  refunded_cents?: number;
  ticket_quantity?: number;
};

export function normalizeCustomerEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeCustomerPhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /[a-z]/i.test(trimmed) || !/^[+\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 16) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function customerCommercialStatus(orders: CustomerOrderSummary[]) {
  const completed = orders.some((order) => ["paid", "partially_refunded"].includes(order.status));
  const refunded = orders.some((order) => order.status === "refunded" || (order.refunded_cents || 0) > 0);
  const incomplete = orders.some((order) => ["pending", "failed", "expired", "cancelled"].includes(order.status));
  if (completed && (refunded || incomplete)) return "Mixed" as const;
  if (completed) return "Purchased" as const;
  if (refunded) return "Refunded" as const;
  return "Did not complete payment" as const;
}

export function summarizeCustomerOrders(orders: CustomerOrderSummary[]) {
  const count = (status: CustomerOrderStatus) => orders.filter((order) => order.status === status).length;
  const completedStatuses = new Set<CustomerOrderStatus>(["paid", "partially_refunded", "refunded"]);
  return {
    totalOrders: orders.length,
    paidOrders: count("paid") + count("partially_refunded"),
    failedOrders: count("failed"),
    pendingOrders: count("pending"),
    expiredOrders: count("expired") + count("cancelled"),
    refundedOrders: count("refunded"),
    totalTickets: orders.filter((order) => completedStatuses.has(order.status)).reduce((sum, order) => sum + (order.ticket_quantity || 0), 0),
    totalSpentCents: orders.filter((order) => completedStatuses.has(order.status)).reduce((sum, order) => sum + Math.max(0, order.total_cents - (order.refunded_cents || 0)), 0),
    status: customerCommercialStatus(orders),
  };
}
