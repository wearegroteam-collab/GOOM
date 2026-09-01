export type SquareErrorDetail = { category?: string; code?: string; detail?: string; field?: string };

export class SquarePaymentError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
    readonly errors: SquareErrorDetail[] = [],
  ) { super(message); this.name = "SquarePaymentError"; }
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

export function squareErrorDiagnostics(error: unknown) {
  if (error instanceof SquarePaymentError) return { httpStatus: error.httpStatus, errors: error.errors };
  const root = object(error);
  const body = object(root?.body) || object(object(root?.response)?.body);
  const candidates = root?.errors || body?.errors;
  const errors = Array.isArray(candidates) ? candidates.map((item) => {
    const value = object(item);
    return { category: String(value?.category || ""), code: String(value?.code || ""), detail: String(value?.detail || ""), field: String(value?.field || "") };
  }) : [];
  const statusValue = root?.statusCode || root?.status || object(root?.response)?.status;
  return { httpStatus: typeof statusValue === "number" ? statusValue : undefined, errors };
}

export function friendlySquarePaymentError(errors: SquareErrorDetail[]) {
  const codes = new Set(errors.map((error) => error.code));
  if (codes.has("CARD_DECLINED")) return "Your card was declined. Please use another card or contact your bank.";
  if (codes.has("VERIFY_CVV_FAILURE") || codes.has("CVV_FAILURE")) return "The security code could not be verified. Please review it and try again.";
  if (codes.has("VERIFY_AVS_FAILURE") || codes.has("INVALID_POSTAL_CODE")) return "The billing information could not be verified. Please review it and try again.";
  if (codes.has("INVALID_PHONE_NUMBER")) return "Please review the buyer phone number and try again.";
  if (codes.has("INVALID_LOCATION")) return "Payments are temporarily unavailable for this location.";
  if (codes.has("PAYMENT_SOURCE_NOT_ENABLED_FOR_TARGET")) return "This payment method is not enabled for the selected location.";
  if (codes.has("NOT_FOUND")) return "The payment configuration could not be found. Please contact GOOM.";
  if (codes.has("UNAUTHORIZED")) return "Payments are temporarily unavailable. Please contact GOOM.";
  return "Payment could not be completed. Please review your details and try again.";
}

export function safeSquareLog(event: string, values: Record<string, unknown>) {
  const allowed = ["environment", "tokenizationStatus", "httpStatus", "category", "code", "detail", "field", "amount", "currency", "locationId", "merchantId", "orderId", "providerPaymentId", "status"];
  const safe = Object.fromEntries(allowed.filter((key) => values[key] !== undefined).map((key) => [key, values[key]]));
  console.info("[GOOM Square]", JSON.stringify({ event, ...safe }));
}
