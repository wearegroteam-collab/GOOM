import "server-only";
import { Square, SquareClient, SquareEnvironment } from "square";
import type { PaymentProvider, PaymentRequest, PaymentResult, RefundResult } from "./payment-provider";
import { buildPaymentIdempotencyKey } from "@/lib/ticketing/core";
import { SquarePaymentError, squareErrorDiagnostics } from "./square-errors";

function squareEnvironment() { return process.env.SQUARE_ENVIRONMENT === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox; }

export class SquareProvider implements PaymentProvider {
  readonly name = "square" as const;
  private client: SquareClient;
  constructor(accessToken: string, private locationId: string) {
    this.client = new SquareClient({ token: accessToken, environment: squareEnvironment() });
  }
  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      const response = await this.client.payments.create({
        sourceId: request.sourceId,
        idempotencyKey: buildPaymentIdempotencyKey(request.orderId),
        amountMoney: { amount: BigInt(request.amountCents), currency: request.currency as Square.Currency },
        autocomplete: true,
        locationId: this.locationId,
        referenceId: request.orderId,
        buyerEmailAddress: request.customerEmail,
        buyerPhoneNumber: request.customerPhone || undefined,
        note: `GOOM ticket order ${request.orderNumber}`,
      });
      const payment = response.payment;
      return { providerPaymentId: payment?.id || "", providerOrderId: payment?.orderId, status: payment?.status === "COMPLETED" ? "completed" : payment?.status === "FAILED" || payment?.status === "CANCELED" ? "failed" : "pending" };
    } catch (error) {
      const diagnostic = squareErrorDiagnostics(error);
      throw new SquarePaymentError("Square CreatePayment failed", diagnostic.httpStatus, diagnostic.errors);
    }
  }
  async refundPayment(request: { paymentId: string; amountCents: number; currency: string; idempotencyKey: string; reason?: string }): Promise<RefundResult> {
    const response = await this.client.refunds.refundPayment({ idempotencyKey: request.idempotencyKey, paymentId: request.paymentId, amountMoney: { amount: BigInt(request.amountCents), currency: request.currency as Square.Currency }, reason: request.reason });
    const refund = response.refund;
    return { providerRefundId: refund?.id || "", status: refund?.status === "COMPLETED" ? "completed" : refund?.status === "FAILED" || refund?.status === "REJECTED" ? "failed" : "pending" };
  }
}
