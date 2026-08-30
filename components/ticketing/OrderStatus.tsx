"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type State = { orderNumber?: string; status?: string; downloadUrl?: string; tickets?: Array<{ number: string; url: string; downloadUrl: string }> };
export function OrderStatus({ token }: { token: string }) { const [state, setState] = useState<State>({ status: "pending" });
  useEffect(() => { let attempts = 0; const load = async () => { const response = await fetch(`/api/ticketing/order-status/${encodeURIComponent(token)}`, { cache: "no-store" }); if (response.ok) { const next = await response.json(); setState(next); if (next.status === "pending" && attempts++ < 20) window.setTimeout(load, 2000); } }; load(); }, [token]);
  if (state.status === "paid") return <div className="checkout-result success"><span>Payment confirmed</span><h1>Your tickets are ready.</h1><p>{state.orderNumber}</p>{state.downloadUrl && <a className="button download-all-tickets" href={state.downloadUrl}>Download all tickets</a>}<div>{state.tickets?.map((ticket) => <div className="success-ticket-actions" key={ticket.number}><Link className="button" href={ticket.url}>View {ticket.number}</Link><a className="outline-link" href={ticket.downloadUrl}>Download ticket</a></div>)}</div></div>;
  if (state.status === "failed" || state.status === "cancelled") return <div className="checkout-result"><span>Payment incomplete</span><h1>Payment could not be completed.</h1><p>Your tickets were not generated. Please return to the event and try again.</p><Link href="/events" className="button">Return to events</Link></div>;
  return <div className="checkout-result pending"><span>Secure confirmation</span><h1>Confirming your payment…</h1><p>Please keep this page open. Tickets appear only after Square confirms the payment.</p><div className="status-loader" /></div>;
}
