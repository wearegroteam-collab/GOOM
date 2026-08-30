import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailBranding } from "./branding";
import { automaticDeliveryKey, deliverTransactionalEmail, retryDeliveryKey } from "./delivery";
import { ResendEmailProvider } from "./resend-provider";
import { SupabaseDeliveryStore } from "./supabase-delivery-store";
import { renderRefundConfirmedEmail } from "./templates";

async function sendRefundEmail(refundId: string, manualRetry: boolean) {
  const admin = createAdminClient();
  const branding = getEmailBranding();
  if (!admin || !branding) return { status: "failed" as const, error: "Email delivery is not configured" };
  try {
    const { data: refund } = await admin.from("refunds").select("*").eq("id", refundId).single();
    if (!refund || refund.status !== "completed") return { status: "skipped" as const };
    const { data: order } = await admin.from("orders").select("*").eq("id", refund.order_id).single();
    if (!order) return { status: "skipped" as const };
    const [{ data: event }, { data: tickets }] = await Promise.all([
      admin.from("events").select("title,date,venue,address,city").eq("id", order.event_id).single(),
      admin.from("tickets").select("ticket_number").eq("order_id", order.id).order("ticket_number"),
    ]);
    if (!event || !tickets?.length) return { status: "skipped" as const };
    const rendered = renderRefundConfirmedEmail({
      branding,
      customerName: order.customer_name,
      orderNumber: order.order_number,
      event: { name: event.title, date: event.date, venue: event.venue, address: event.address, city: event.city },
      refundAmountCents: refund.amount_cents,
      currency: refund.currency,
      ticketNumbers: tickets.map((ticket) => ticket.ticket_number),
      orderUrl: `${branding.siteUrl}/checkout/${order.public_token}`,
    });
    const baseKey = automaticDeliveryKey("refund_confirmed", refund.id);
    const { count } = await admin.from("email_deliveries").select("id", { count: "exact", head: true }).eq("refund_id", refund.id).eq("type", "refund_confirmed");
    return await deliverTransactionalEmail({
      store: new SupabaseDeliveryStore(admin),
      provider: new ResendEmailProvider(),
      orderId: order.id,
      refundId: refund.id,
      type: "refund_confirmed",
      recipient: order.customer_email,
      message: rendered,
      idempotencyKey: manualRetry ? retryDeliveryKey(baseKey) : baseKey,
      attemptNumber: (count || 0) + 1,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[GOOM refund email]", error);
    return { status: "failed" as const, error: error instanceof Error ? error.message : "Email delivery failed" };
  }
}

export function sendRefundConfirmationOnce(refundId: string) {
  return sendRefundEmail(refundId, false);
}

export function resendRefundConfirmation(refundId: string) {
  return sendRefundEmail(refundId, true);
}
