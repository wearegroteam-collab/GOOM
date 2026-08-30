export type PaymentRequest = {
  orderId: string; orderNumber: string; sourceId: string; amountCents: number;
  currency: string; customerEmail: string; customerPhone?: string | null;
};

export type PaymentResult = { providerPaymentId: string; providerOrderId?: string | null; status: "pending" | "completed" | "failed" };
export type RefundResult = { providerRefundId: string; status: "pending" | "completed" | "failed" };

export interface PaymentProvider {
  readonly name: "mock" | "square";
  createPayment(request: PaymentRequest): Promise<PaymentResult>;
  refundPayment(request: { paymentId: string; amountCents: number; currency: string; idempotencyKey: string; reason?: string }): Promise<RefundResult>;
}
