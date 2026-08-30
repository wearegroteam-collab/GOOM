import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSquareAccess, ticketingProviderName } from "@/lib/payments/connection";
import { MockPaymentProvider } from "@/lib/payments/mock-provider";
import { SquareProvider } from "@/lib/payments/square-provider";
import { sendOrderTicketsOnce } from "@/lib/email/send-order-tickets";

export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  try {
    const body = await request.json() as { orderToken?: string; sourceId?: string };
    if (!body.orderToken || !body.sourceId) return NextResponse.json({ error: "Payment details are incomplete." }, { status: 400 });
    const { data: order } = await admin.from("orders").select("*").eq("public_token", body.orderToken).maybeSingle();
    if (!order || order.status !== "pending" || (order.reservation_expires_at && new Date(order.reservation_expires_at) <= new Date())) return NextResponse.json({ error: "This ticket reservation has expired." }, { status: 409 });
    const providerName = ticketingProviderName();
    if (order.payment_provider !== providerName) return NextResponse.json({ error: "This order cannot be paid in the current payment environment." }, { status: 409 });
    const provider = providerName === "mock"
      ? new MockPaymentProvider()
      : await (async () => { const access = await getSquareAccess(); if (!access) throw new Error("Square is not connected"); return new SquareProvider(access.accessToken, access.locationId); })();
    const result = await provider.createPayment({ orderId: order.id, orderNumber: order.order_number, sourceId: body.sourceId, amountCents: order.total_cents, currency: order.currency, customerEmail: order.customer_email, customerPhone: order.customer_phone });
    if (result.providerPaymentId) await admin.from("orders").update({ provider_payment_id: result.providerPaymentId, provider_order_id: result.providerOrderId || null }).eq("id", order.id).eq("status", "pending");
    if (providerName === "mock") {
      if (result.status === "completed") { await admin.rpc("finalize_paid_ticket_order", { p_order_id: order.id, p_provider_payment_id: result.providerPaymentId, p_provider_order_id: result.providerOrderId || null }); await sendOrderTicketsOnce(order.id); }
      else await admin.rpc("fail_ticket_order", { p_order_id: order.id });
    }
    return NextResponse.json({ status: result.status });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[GOOM payment]", error);
    return NextResponse.json({ error: "Payment could not be completed. Please try again." }, { status: 400 });
  }
}
