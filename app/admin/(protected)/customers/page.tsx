import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/ticketing/core";
import { summarizeCustomerOrders } from "@/lib/ticketing/customer";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: customers } = supabase ? await supabase.from("customers").select("*").order("last_seen_at", { ascending: false }).limit(500) : { data: [] };
  const customerIds = (customers || []).map((customer) => customer.id);
  const { data: orders } = customerIds.length && supabase ? await supabase.from("orders").select("id,customer_id,status,total_cents,refunded_cents").in("customer_id", customerIds) : { data: [] };
  const orderIds = (orders || []).map((order) => order.id);
  const { data: items } = orderIds.length && supabase ? await supabase.from("order_items").select("order_id,quantity").in("order_id", orderIds) : { data: [] };
  const ticketCounts = new Map<string, number>();
  for (const item of items || []) ticketCounts.set(item.order_id, (ticketCounts.get(item.order_id) || 0) + item.quantity);
  const rows = (customers || []).map((customer) => {
    const related = (orders || []).filter((order) => order.customer_id === customer.id).map((order) => ({ ...order, ticket_quantity: ticketCounts.get(order.id) || 0 }));
    return { customer, summary: summarizeCustomerOrders(related) };
  }).filter(({ customer, summary }) => {
    const search = (query.q || "").trim().toLowerCase();
    const matchesSearch = !search || `${customer.full_name} ${customer.email} ${customer.phone || ""}`.toLowerCase().includes(search);
    const matchesFilter = !query.filter || query.filter === "all" || (query.filter === "purchased" && ["Purchased", "Mixed"].includes(summary.status)) || (query.filter === "did_not_purchase" && summary.status === "Did not complete payment") || (query.filter === "refunded" && ["Refunded", "Mixed"].includes(summary.status));
    return matchesSearch && matchesFilter;
  });

  return <><AdminPageHeader eyebrow="Audience" title="Customers" description="GOOM-owned customer history from every checkout attempt, purchase, expiration and refund." />
    <form className="admin-customer-filters"><input name="q" defaultValue={query.q} placeholder="Search name, email or phone" /><select name="filter" defaultValue={query.filter || "all"}><option value="all">All</option><option value="purchased">Purchased</option><option value="did_not_purchase">Did not purchase</option><option value="refunded">Refunded</option></select><button className="admin-secondary-button">Filter</button></form>
    <div className="admin-table admin-customers-table"><div className="admin-table-head"><span>Customer</span><span>Email</span><span>Phone</span><span>Last activity</span><span>Orders</span><span>Paid</span><span>Tickets</span><span>Total spent</span><span>Status</span><span /></div>
      {rows.map(({ customer, summary }) => <div className="admin-table-row" key={customer.id}><div><strong>{customer.full_name}</strong><small>Since {new Date(customer.first_seen_at).toLocaleDateString()}</small></div><span>{customer.email}</span><span>{customer.phone || "—"}</span><span>{new Date(customer.last_seen_at).toLocaleString()}</span><strong>{summary.totalOrders}</strong><strong>{summary.paidOrders}</strong><strong>{summary.totalTickets}</strong><strong>{money(summary.totalSpentCents, "CAD")}</strong><em className={`admin-status ${summary.status.toLowerCase().replaceAll(" ", "-")}`}>{summary.status}</em><Link href={`/admin/customers/${customer.id}`}>View →</Link></div>)}
      {!rows.length && <div className="admin-empty"><strong>No customers found.</strong><p>Checkout attempts will appear here automatically.</p></div>}
    </div></>;
}
