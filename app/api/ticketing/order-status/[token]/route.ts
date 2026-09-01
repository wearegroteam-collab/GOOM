import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  await admin.rpc("release_expired_ticket_reservations");
  const { data: order } = await admin.from("orders").select("id,public_token,order_number,status,event_id").eq("public_token", token).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const { data: tickets } = order.status === "paid" ? await admin.from("tickets").select("ticket_number,verification_token").eq("order_id", order.id).order("ticket_number") : { data: [] };
  return NextResponse.json({ orderNumber: order.order_number, status: order.status, downloadUrl: tickets?.length ? `/api/orders/${order.public_token}/tickets.pdf` : undefined, tickets: (tickets || []).map((ticket) => ({ number: ticket.ticket_number, url: `/tickets/${ticket.verification_token}`, downloadUrl: `/api/tickets/${ticket.verification_token}/pdf` })) }, { headers: { "Cache-Control": "no-store" } });
}
