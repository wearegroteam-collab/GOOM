import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { CheckoutPayment } from "@/components/ticketing/CheckoutPayment";
import { money } from "@/lib/ticketing/core";

export default async function CheckoutPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const admin = createAdminClient(); if (!admin) notFound();
  const { data: order } = await admin.from("orders").select("*").eq("public_token", token).maybeSingle(); if (!order) notFound();
  const [{ data: event }, { data: items }] = await Promise.all([admin.from("events").select("title,slug,date,venue").eq("id", order.event_id).single(), admin.from("order_items").select("quantity,unit_price_cents,total_cents,ticket_type_id").eq("order_id", order.id)]);
  const typeIds = (items || []).map((item) => item.ticket_type_id); const { data: types } = typeIds.length ? await admin.from("ticket_types").select("id,name").in("id", typeIds) : { data: [] }; const names = new Map((types || []).map((type) => [type.id, type.name]));
  return <main className="checkout-page"><section className="checkout-shell"><div className="checkout-summary"><span className="checkout-brand">GOOM <small>EVENT PRODUCTION</small></span><p className="section-eyebrow"><span />Secure checkout</p><h1>{event?.title || "Event tickets"}</h1><p><Clock3 />Reservation held for 15 minutes</p><div className="checkout-lines">{(items || []).map((item) => <div key={item.ticket_type_id}><span>{item.quantity} × {names.get(item.ticket_type_id) || "Ticket"}</span><strong>{money(item.total_cents, order.currency)}</strong></div>)}<div><span>Subtotal</span><strong>{money(order.subtotal_cents, order.currency)}</strong></div><div><span>Service fee</span><strong>{money(order.fees_cents, order.currency)}</strong></div><div className="checkout-total"><span>Total</span><strong>{money(order.total_cents, order.currency)} {order.currency}</strong></div></div><p>Order {order.order_number}<br />Tickets for {order.customer_email}</p>{event && <Link href={`/events/${event.slug}`}>← Return to event</Link>}</div><CheckoutPayment orderToken={token} /></section></main>;
}
