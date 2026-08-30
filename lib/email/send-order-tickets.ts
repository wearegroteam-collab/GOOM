import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ResendEmailProvider } from "./resend-provider";

export async function sendOrderTicketsOnce(orderId: string) {
  const admin = createAdminClient();
  if (!admin) return;
  const { data: existing } = await admin.from("email_deliveries").select("id,status").eq("order_id", orderId).eq("template", "tickets").maybeSingle();
  if (existing) return;
  if (!existing) {
    const { error } = await admin.from("email_deliveries").insert({ order_id: orderId, template: "tickets", status: "pending" });
    if (error?.code === "23505") return;
  }
  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).single();
  if (!order || order.status !== "paid") return;
  const [{ data: event }, { data: tickets }] = await Promise.all([
    admin.from("events").select("title,date,venue").eq("id", order.event_id).single(),
    admin.from("tickets").select("ticket_number,verification_token").eq("order_id", orderId).order("ticket_number"),
  ]);
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!event || !tickets?.length || !origin || !process.env.RESEND_API_KEY || !process.env.TICKETS_FROM_EMAIL) return;
  try {
    const result = await new ResendEmailProvider().sendTickets({ orderNumber: order.order_number, customerName: order.customer_name, customerEmail: order.customer_email, eventName: event.title, eventDate: event.date, venue: event.venue, tickets: tickets.map((ticket) => ({ ticketNumber: ticket.ticket_number, url: `${origin.replace(/\/$/, "")}/tickets/${ticket.verification_token}` })) });
    await admin.from("email_deliveries").update({ status: "sent", provider_message_id: result.messageId, sent_at: new Date().toISOString(), last_error: null }).eq("order_id", orderId).eq("template", "tickets");
    await admin.from("orders").update({ email_sent_at: new Date().toISOString() }).eq("id", orderId);
  } catch (error) {
    await admin.from("email_deliveries").update({ status: "failed", last_error: error instanceof Error ? error.message : "Email failed" }).eq("order_id", orderId).eq("template", "tickets");
  }
}
