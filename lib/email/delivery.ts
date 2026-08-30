import type { EmailProvider } from "./email-provider";
import type { EmailMessage, EmailType } from "./types";

export type DeliveryAttempt = { id: string };
export type DeliveryStore = {
  create(input: { orderId: string; refundId?: string; type: EmailType; recipient: string; idempotencyKey: string; attemptNumber: number }): Promise<DeliveryAttempt | null>;
  markSent(id: string, providerMessageId: string | null): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
};

export function automaticDeliveryKey(type: EmailType, entityId: string) {
  if (type === "tickets_ready") return `order_paid:${entityId}`;
  if (type === "complimentary") return `complimentary:${entityId}`;
  if (type === "refund_confirmed") return `refund_confirmed:${entityId}`;
  return `${type}:${entityId}`;
}

export function retryDeliveryKey(baseKey: string, attemptId = crypto.randomUUID()) {
  return `${baseKey}:retry:${attemptId}`;
}

export async function deliverTransactionalEmail(input: {
  store: DeliveryStore;
  provider: EmailProvider;
  orderId: string;
  refundId?: string;
  type: EmailType;
  recipient: string;
  message: Omit<EmailMessage, "to" | "idempotencyKey">;
  idempotencyKey: string;
  attemptNumber?: number;
}) {
  const attempt = await input.store.create({ orderId: input.orderId, refundId: input.refundId, type: input.type, recipient: input.recipient, idempotencyKey: input.idempotencyKey, attemptNumber: input.attemptNumber || 1 });
  if (!attempt) return { status: "skipped" as const };
  try {
    const result = await input.provider.send({ ...input.message, to: input.recipient, idempotencyKey: input.idempotencyKey });
    await input.store.markSent(attempt.id, result.messageId);
    return { status: "sent" as const, messageId: result.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery failed";
    await input.store.markFailed(attempt.id, message);
    return { status: "failed" as const, error: message };
  }
}
