import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSquareAccess, ticketingProviderName } from "@/lib/payments/connection";
import { MockPaymentProvider } from "@/lib/payments/mock-provider";
import { SquareProvider } from "@/lib/payments/square-provider";
import { friendlySquarePaymentError, safeSquareLog, squareErrorDiagnostics } from "@/lib/payments/square-errors";
import { squareTargetEnvironment } from "@/lib/payments/square-oauth";
import { sendOrderTicketsOnce } from "@/lib/email/send-order-tickets";
import type { OrderRecord } from "@/lib/supabase/types";

export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  let order: OrderRecord | null = null;
  try {
    const body = await request.json() as { orderToken?: string; sourceId?: string; tokenizationStatus?: string };
    if (!body.orderToken || !body.sourceId) return NextResponse.json({ error: "Payment details are incomplete." }, { status: 400 });
    const result = await admin.from("orders").select("*").eq("public_token", body.orderToken).maybeSingle();
    order = result.data;
    if (!order || order.status !== "pending") return NextResponse.json({ error: "This ticket reservation is no longer payable." }, { status: 409 });

    const { data: started, error: startError } = await admin.rpc("begin_ticket_payment", { p_order_id: order.id });
    if (startError || !started) return NextResponse.json({ error: "This ticket reservation has expired." }, { status: 409 });
    const providerName = ticketingProviderName();
    if (order.payment_provider !== providerName) return NextResponse.json({ error: "This order cannot be paid in the current payment environment." }, { status: 409 });

    let provider;
    let locationId: string | undefined;
    let merchantId: string | undefined;
    if (providerName === "mock") provider = new MockPaymentProvider();
    else {
      const access = await getSquareAccess();
      if (!access) throw new Error("Square Production connection is unavailable or does not match the configured environment");
      locationId = access.locationId;
      merchantId = access.connection.account_reference || undefined;
      provider = new SquareProvider(access.accessToken, access.locationId);
    }

    safeSquareLog("create_payment_started", { environment: providerName === "mock" ? "mock" : squareTargetEnvironment(), tokenizationStatus: body.tokenizationStatus, amount: order.total_cents, currency: order.currency, locationId, merchantId, orderId: order.id });
    const payment = await provider.createPayment({ orderId: order.id, orderNumber: order.order_number, sourceId: body.sourceId, amountCents: order.total_cents, currency: order.currency, customerEmail: order.customer_email, customerPhone: order.customer_phone });
    if (payment.providerPaymentId) await admin.from("orders").update({ provider_payment_id: payment.providerPaymentId, provider_order_id: payment.providerOrderId || null }).eq("id", order.id).eq("status", "pending");
    safeSquareLog("create_payment_result", { environment: order.payment_environment, status: payment.status, amount: order.total_cents, currency: order.currency, locationId, merchantId, orderId: order.id, providerPaymentId: payment.providerPaymentId || undefined });

    if (payment.status === "completed") {
      const { error: finalizeError } = await admin.rpc("finalize_paid_ticket_order", { p_order_id: order.id, p_provider_payment_id: payment.providerPaymentId, p_provider_order_id: payment.providerOrderId || null });
      if (finalizeError) throw finalizeError;
      await sendOrderTicketsOnce(order.id);
    } else if (payment.status === "failed") await admin.rpc("fail_ticket_order", { p_order_id: order.id });
    return NextResponse.json({ status: payment.status });
  } catch (error) {
    const diagnostic = squareErrorDiagnostics(error);
    const first = diagnostic.errors[0];
    if (order?.id) {
      await admin.rpc("fail_ticket_order", { p_order_id: order.id });
      await admin.from("orders").update({ payment_failed_at: new Date().toISOString(), payment_error_http_status: diagnostic.httpStatus || null, payment_error_category: first?.category || null, payment_error_code: first?.code || null, payment_error_detail: first?.detail?.slice(0, 500) || null }).eq("id", order.id);
    }
    safeSquareLog("create_payment_failed", { environment: order?.payment_environment || squareTargetEnvironment(), httpStatus: diagnostic.httpStatus, category: first?.category, code: first?.code, detail: first?.detail, field: first?.field, amount: order?.total_cents, currency: order?.currency, orderId: order?.id });
    return NextResponse.json({ error: friendlySquarePaymentError(diagnostic.errors), code: first?.code || undefined }, { status: diagnostic.httpStatus === 401 ? 503 : 400 });
  }
}
