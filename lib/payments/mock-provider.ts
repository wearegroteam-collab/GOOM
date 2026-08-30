import type { PaymentProvider, PaymentRequest, PaymentResult, RefundResult } from "./payment-provider";

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock" as const;
  constructor() { if (process.env.NODE_ENV === "production") throw new Error("Mock payments are disabled in production"); }
  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    if (request.sourceId === "mock-failure") return { providerPaymentId: `mock_failed_${request.orderId}`, status: "failed" };
    return { providerPaymentId: `mock_${request.orderId}`, status: "completed" };
  }
  async refundPayment({ idempotencyKey }: { idempotencyKey: string }): Promise<RefundResult> {
    return { providerRefundId: `mock_refund_${idempotencyKey}`, status: "completed" };
  }
}
