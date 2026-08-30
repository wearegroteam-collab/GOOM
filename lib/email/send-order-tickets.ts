import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailBranding } from "./branding";
import { automaticDeliveryKey, deliverTransactionalEmail, retryDeliveryKey } from "./delivery";
import { ResendEmailProvider } from "./resend-provider";
import { SupabaseDeliveryStore } from "./supabase-delivery-store";
import { renderComplimentaryEmail, renderTicketsReadyEmail } from "./templates";
import type { EmailType, TicketEmailItem } from "./types";

async function sendOrderEmail(orderId: string, manualRetry: boolean) {
  const admin = createAdminClient();
  const branding = getEmailBranding();
  if (!admin || !branding) return { status: "failed" as const, error: "Email delivery is not configured" };

  try {
    const { data: order } = await admin.from("orders").select("*").eq("id", orderId).single();
    if (!order || order.status !== "paid") return { status: "skipped" as const };
    const [{ data: event }, { data: tickets }] = await Promise.all([
      admin.from("events").select("title,date,venue,address,city").eq("id", order.event_id).single(),
      admin.from("tickets").select("ticket_number,verification_token,ticket_type_id,attendee_name").eq("order_id", orderId).order("ticket_number"),
    ]);
    if (!event || !tickets?.length) return { status: "skipped" as const };

    const typeIds = [...new Set(tickets.map((ticket) => ticket.ticket_type_id))];
    const { data: ticketTypes } = await admin.from("ticket_types").select("id,name").in("id", typeIds);
    const typeNames = new Map((ticketTypes || []).map((ticketType) => [ticketType.id, ticketType.name]));
    const ticketItems: TicketEmailItem[] = tickets.map((ticket) => ({
      ticketNumber: ticket.ticket_number,
      ticketType: typeNames.get(ticket.ticket_type_id) || "Event ticket",
      attendeeName: ticket.attendee_name,
      url: `${branding.siteUrl}/tickets/${ticket.verification_token}`,
    }));
    const eventDetails = { name: event.title, date: event.date, venue: event.venue, address: event.address, city: event.city };
    const orderUrl = `${branding.siteUrl}/checkout/${order.public_token}`;
    const downloadAllUrl = `${branding.siteUrl}/api/orders/${order.public_token}/tickets.pdf`;
    const type: EmailType = order.payment_type === "complimentary" ? "complimentary" : "tickets_ready";
    const rendered = type === "complimentary"
      ? renderComplimentaryEmail({ branding, customerName: order.customer_name, event: eventDetails, tickets: ticketItems, orderUrl, downloadAllUrl })
      : renderTicketsReadyEmail({
          branding,
          customerName: order.customer_name,
          orderNumber: order.order_number,
          event: eventDetails,
          tickets: ticketItems,
          orderUrl,
          downloadAllUrl,
          amounts: { subtotalCents: order.subtotal_cents, feesCents: order.fees_cents, totalCents: order.total_cents, currency: order.currency, paymentProvider: order.payment_provider },
        });
    const baseKey = automaticDeliveryKey(type, order.id);
    const { count } = await admin.from("email_deliveries").select("id", { count: "exact", head: true }).eq("order_id", order.id).eq("type", type);
    const result = await deliverTransactionalEmail({
      store: new SupabaseDeliveryStore(admin),
      provider: new ResendEmailProvider(),
      orderId: order.id,
      type,
      recipient: order.customer_email,
      message: rendered,
      idempotencyKey: manualRetry ? retryDeliveryKey(baseKey) : baseKey,
      attemptNumber: (count || 0) + 1,
    });
    if (result.status === "sent") await admin.from("orders").update({ email_sent_at: new Date().toISOString() }).eq("id", order.id);
    return result;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[GOOM email]", error);
    return { status: "failed" as const, error: error instanceof Error ? error.message : "Email delivery failed" };
  }
}

export function sendOrderTicketsOnce(orderId: string) {
  return sendOrderEmail(orderId, false);
}

export function resendOrderTickets(orderId: string) {
  return sendOrderEmail(orderId, true);
}
