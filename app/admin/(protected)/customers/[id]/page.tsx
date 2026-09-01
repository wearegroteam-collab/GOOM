import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/ticketing/core";
import { summarizeCustomerOrders } from "@/lib/ticketing/customer";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (!customer) notFound();
  const { data: orders } = await supabase.from("orders").select("*").eq("customer_id", id).order("created_at", { ascending: false });
  const orderIds = (orders || []).map((order) => order.id);
  const { data: items } = orderIds.length ? await supabase.from("order_items").select("order_id,quantity").in("order_id", orderIds) : { data: [] };
  const eventIds = [...new Set((orders || []).map((order) => order.event_id))];
  const { data: events } = eventIds.length ? await supabase.from("events").select("id,title").in("id", eventIds) : { data: [] };
  const eventNames = new Map((events || []).map((event) => [event.id, event.title]));
  const ticketCounts = new Map<string, number>();
  for (const item of items || []) ticketCounts.set(item.order_id, (ticketCounts.get(item.order_id) || 0) + item.quantity);
  const summary = summarizeCustomerOrders((orders || []).map((order) => ({ ...order, ticket_quantity: ticketCounts.get(order.id) || 0 })));

  return <><AdminPageHeader eyebrow="Customer detail" title={customer.full_name} description={summary.status === "Did not complete payment" ? "This person attempted checkout but did not complete payment." : "This customer has completed at least one purchase."} action={<Link href="/admin/customers" className="admin-secondary-button">Back to customers</Link>} />
    <section className="customer-summary-grid"><div><span>Email</span><strong>{customer.email}</strong></div><div><span>Phone</span><strong>{customer.phone || "—"}</strong></div><div><span>First seen</span><strong>{new Date(customer.first_seen_at).toLocaleString()}</strong></div><div><span>Last activity</span><strong>{new Date(customer.last_seen_at).toLocaleString()}</strong></div><div><span>Total spent</span><strong>{money(summary.totalSpentCents, "CAD")}</strong></div><div><span>Total tickets</span><strong>{summary.totalTickets}</strong></div><div><span>Total orders</span><strong>{summary.totalOrders}</strong></div><div><span>Commercial status</span><strong>{summary.status}</strong></div></section>
    <section className="admin-record-card customer-timeline"><h2>Order history</h2>{(orders || []).map((order) => <article key={order.id}><div><span>{new Date(order.created_at).toLocaleString()}</span><h3>{eventNames.get(order.event_id) || "Event"}</h3><Link href={`/admin/orders/${order.id}`}>{order.order_number}</Link></div><dl><div><dt>Tickets</dt><dd>{ticketCounts.get(order.id) || 0}</dd></div><div><dt>Total</dt><dd>{money(order.total_cents, order.currency)}</dd></div><div><dt>Service fee</dt><dd>{money(order.fees_cents, order.currency)}</dd></div><div><dt>Environment</dt><dd>{order.payment_environment}</dd></div></dl><em className={`admin-status ${order.status}`}>{order.status}</em></article>)}</section></>;
}
