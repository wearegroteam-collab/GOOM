"use client";
import { useMemo, useState } from "react";
import { Minus, Plus, ShieldCheck, Ticket } from "lucide-react";
import { useRouter } from "next/navigation";
import type { TicketTypeRecord } from "@/lib/supabase/types";
import { MAX_TICKETS_PER_ORDER, money } from "@/lib/ticketing/core";

const saleDate = (value: string) => new Intl.DateTimeFormat("en-CA", { dateStyle: "long", timeStyle: "short", timeZone: "America/Toronto" }).format(new Date(value));

export function TicketSelector({ eventId, ticketTypes, nowIso }: { eventId: string; ticketTypes: TicketTypeRecord[]; nowIso: string }) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>({}); const [buyerOpen, setBuyerOpen] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const totalQuantity = Object.values(quantities).reduce((sum, value) => sum + value, 0);
  const now = new Date(nowIso).getTime();
  const subtotal = useMemo(() => ticketTypes.reduce((sum, ticket) => sum + ticket.price_cents * (quantities[ticket.id] || 0), 0), [quantities, ticketTypes]);
  const selectedTickets = ticketTypes.filter((ticket) => (quantities[ticket.id] || 0) > 0);
  const isOnSale = (ticket: TicketTypeRecord) => (!ticket.sales_start || new Date(ticket.sales_start).getTime() <= now) && (!ticket.sales_end || new Date(ticket.sales_end).getTime() > now);
  const change = (ticket: TicketTypeRecord, delta: number) => setQuantities((current) => {
    if (!isOnSale(ticket)) return current;
    const currentCount = current[ticket.id] || 0;
    const remainingOrderCapacity = MAX_TICKETS_PER_ORDER - (totalQuantity - currentCount);
    const maximum = Math.min(ticket.quantity_total - ticket.quantity_sold - ticket.quantity_reserved, MAX_TICKETS_PER_ORDER, remainingOrderCapacity);
    return { ...current, [ticket.id]: Math.max(0, Math.min(maximum, currentCount + delta)) };
  });
  async function checkout(formData: FormData) {
    setBusy(true); setError("");
    const response = await fetch("/api/ticketing/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, name: formData.get("name"), email: formData.get("email"), phone: formData.get("phone"), items: ticketTypes.map((ticket) => ({ ticketTypeId: ticket.id, quantity: quantities[ticket.id] || 0 })).filter((item) => item.quantity > 0) }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Unable to reserve tickets."); setBusy(false); return; }
    router.push(`/checkout/${data.order.public_token}`);
  }
  return <section className="goom-ticket-selector"><div className="ticketing-heading"><p className="section-eyebrow"><span />Official GOOM ticketing</p><h2>Get <em>tickets.</em></h2><p>Select your tickets below. Final availability is confirmed securely when the reservation is created.</p></div>
    <div className="ticket-type-list">{ticketTypes.map((ticket) => { const available = Math.max(0, ticket.quantity_total - ticket.quantity_sold - ticket.quantity_reserved); const count = quantities[ticket.id] || 0; const upcoming = Boolean(ticket.sales_start && new Date(ticket.sales_start).getTime() > now); const ended = Boolean(ticket.sales_end && new Date(ticket.sales_end).getTime() <= now); const purchasable = !upcoming && !ended && available > 0; const status = upcoming ? `Tickets go on sale on ${saleDate(ticket.sales_start!)}` : ended ? "Sales ended" : available <= 0 ? "SOLD OUT" : `${available} available`; return <article className={`ticket-type-public${purchasable ? "" : " is-unavailable"}`} key={ticket.id}><div><Ticket /><h3>{ticket.name}</h3>{ticket.description && <p>{ticket.description}</p>}<small>{status}</small></div><strong>{money(ticket.price_cents, ticket.currency)} <small>{ticket.currency}</small></strong><div className="ticket-counter"><button type="button" aria-label={`Remove ${ticket.name}`} onClick={() => change(ticket, -1)} disabled={!purchasable || !count}><Minus /></button><span>{count}</span><button type="button" aria-label={`Add ${ticket.name}`} onClick={() => change(ticket, 1)} disabled={!purchasable || available <= count || count >= MAX_TICKETS_PER_ORDER || totalQuantity >= MAX_TICKETS_PER_ORDER}><Plus /></button></div></article>; })}</div>
    <div className="ticket-order-summary"><h3>Order Summary</h3>{selectedTickets.length ? selectedTickets.map((ticket) => <div key={ticket.id}><span>{ticket.name} × {quantities[ticket.id]}</span><strong>{money(ticket.price_cents * quantities[ticket.id], ticket.currency)} <small>{ticket.currency}</small></strong></div>) : <p>No tickets selected yet.</p>}<div className="ticket-order-total"><span>Total</span><strong>{money(subtotal, ticketTypes[0]?.currency || "CAD")} <small>{ticketTypes[0]?.currency || "CAD"}</small></strong></div></div>
    <div className="ticket-checkout-summary"><span>{totalQuantity} {totalQuantity === 1 ? "ticket" : "tickets"} selected</span><button className="button" type="button" disabled={!totalQuantity} onClick={() => setBuyerOpen(true)}>Continue to checkout</button></div>
    {buyerOpen && <div className="buyer-panel"><div><h3>Buyer details</h3><p>Your tickets will be delivered to this email.</p></div><form action={checkout}><label>Full name<input name="name" autoComplete="name" required /></label><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Phone <small>optional</small><input name="phone" type="tel" autoComplete="tel" /></label>{error && <p className="checkout-error">{error}</p>}<button className="button" disabled={busy}>{busy ? "Reserving…" : "Reserve tickets"}</button><button type="button" className="text-button" onClick={() => setBuyerOpen(false)}>Back</button><p className="secure-note"><ShieldCheck />Your reservation is held for 15 minutes.</p></form></div>}
  </section>;
}
