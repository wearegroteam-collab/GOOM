import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { createClient } from "@/lib/supabase/server";
import type { EmailDeliveryRecord } from "@/lib/supabase/types";
import { money } from "@/lib/ticketing/core";
import { refundOrder, resendTransactionalEmail } from "../actions";

function DeliveryStatus({ delivery, orderId, kind, recipient, refundId }: { delivery?: EmailDeliveryRecord; orderId: string; kind: "tickets"|"refund"; recipient: string; refundId?: string }) {
  const status = delivery?.status || "pending";
  return <div className="email-delivery-row"><div><strong>{kind === "tickets" ? "Ticket email" : "Refund email"}</strong><span className={`admin-status ${status}`}>{status}</span></div><dl><div><dt>Recipient</dt><dd><a href={`mailto:${delivery?.recipient || recipient}`}>{delivery?.recipient || recipient}</a></dd></div><div><dt>Sent at</dt><dd>{delivery?.sent_at ? new Date(delivery.sent_at).toLocaleString() : "—"}</dd></div><div><dt>Provider</dt><dd>{delivery?.provider || "Resend"}</dd></div></dl>{delivery?.error && <p>{delivery.error}</p>}{delivery?.status === "failed" && <form action={resendTransactionalEmail.bind(null,orderId,kind,refundId)}><button className="admin-secondary-button">RESEND EMAIL</button></form>}</div>;
}

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string,string|undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();
  const [{ data: event }, { data: tickets }, { data: items }, { data: deliveries }, { data: refunds }] = await Promise.all([
    supabase.from("events").select("title").eq("id",order.event_id).single(),
    supabase.from("tickets").select("*").eq("order_id",id).order("ticket_number"),
    supabase.from("order_items").select("*").eq("order_id",id),
    supabase.from("email_deliveries").select("*").eq("order_id",id).order("created_at",{ascending:false}),
    supabase.from("refunds").select("*").eq("order_id",id).order("created_at",{ascending:false}),
  ]);
  const typeIds = [...new Set([...(tickets || []).map((ticket)=>ticket.ticket_type_id),...(items || []).map((item)=>item.ticket_type_id)])];
  const { data: types } = typeIds.length ? await supabase.from("ticket_types").select("id,name").in("id",typeIds) : { data: [] };
  const typeNames = new Map((types || []).map((type)=>[type.id,type.name]));
  const ticketType = order.payment_type === "complimentary" ? "complimentary" : "tickets_ready";
  const ticketDelivery = deliveries?.find((delivery)=>delivery.type===ticketType);
  const refundDelivery = deliveries?.find((delivery)=>delivery.type==="refund_confirmed");
  const completedRefund = refunds?.find((refund)=>refund.status==="completed");

  return <><AdminPageHeader eyebrow="Order detail" title={order.order_number} description={`${event?.title || "Event"} · ${order.status}`} action={<Link href="/admin/orders" className="admin-secondary-button">Back to orders</Link>} />
  {query.created && <p className="admin-success">Complimentary tickets created.</p>}
  {query.refund === "completed" && <p className="admin-success">Refund completed. Tickets and inventory were updated.</p>}
  {query.refund === "submitted" && <p className="admin-success">Refund submitted. Square will confirm its final status by webhook.</p>}
  {query.already_refunded && <p className="admin-success">This order was already refunded. No duplicate refund was created.</p>}
  {query.email === "sent" && <p className="admin-success">Email sent successfully.</p>}
  {query.email === "failed" && <p className="admin-form-error">Email could not be sent. The order and tickets were not changed.</p>}
  {query.error && <p className="admin-form-error">This refund could not be completed.</p>}
  <section className="order-detail-grid"><article className="admin-record-card"><h2>Customer</h2><dl><div><dt>Name</dt><dd>{order.customer_name}</dd></div><div><dt>Email</dt><dd>{order.customer_email}</dd></div><div><dt>Phone</dt><dd>{order.customer_phone || "—"}</dd></div></dl></article><article className="admin-record-card"><h2>Payment</h2><dl><div><dt>Tickets subtotal</dt><dd>{money(order.subtotal_cents,order.currency)}</dd></div><div><dt>Service fee</dt><dd>{money(order.fees_cents,order.currency)}</dd></div><div><dt>Total paid</dt><dd>{money(order.total_cents,order.currency)}</dd></div><div><dt>Provider</dt><dd>{order.payment_provider}</dd></div><div><dt>Status</dt><dd>{order.status}</dd></div><div><dt>Payment ID</dt><dd className="break-value">{order.provider_payment_id || "—"}</dd></div></dl>{order.status === "paid" && order.total_cents > 0 && <form action={refundOrder.bind(null,order.id)}><button className="admin-danger-button">Refund full order</button></form>}</article></section>
  <section className="admin-record-card email-delivery-card"><h2>Email delivery</h2><DeliveryStatus delivery={ticketDelivery} orderId={order.id} kind="tickets" recipient={order.customer_email} />{completedRefund && <DeliveryStatus delivery={refundDelivery} orderId={order.id} kind="refund" recipient={order.customer_email} refundId={completedRefund.id} />}</section>
  {(order.payment_error_code || order.payment_error_detail) && <section className="admin-record-card payment-diagnostic-card"><h2>Payment diagnostic</h2><p>Safe Square response captured for this attempt. No card data or credentials are stored.</p><dl><div><dt>HTTP status</dt><dd>{order.payment_error_http_status || "—"}</dd></div><div><dt>Category</dt><dd>{order.payment_error_category || "—"}</dd></div><div><dt>Code</dt><dd>{order.payment_error_code || "—"}</dd></div><div><dt>Detail</dt><dd>{order.payment_error_detail || "—"}</dd></div></dl></section>}
  <section className="admin-record-card order-tickets"><h2>Tickets</h2>{tickets?.length ? tickets.map((ticket)=><div key={ticket.id}><div><strong>{ticket.ticket_number}</strong><span>{typeNames.get(ticket.ticket_type_id)} · {ticket.attendee_name}</span></div><em className={`admin-status ${ticket.status}`}>{ticket.status}</em><Link href={`/tickets/${ticket.verification_token}`} target="_blank">Open ticket ↗</Link></div>) : <p>No tickets have been generated. Pending orders require provider confirmation.</p>}</section></>;
}
