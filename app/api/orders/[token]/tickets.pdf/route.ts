import { createAdminClient } from "@/lib/supabase/admin";
import type { TicketRecord } from "@/lib/supabase/types";
import { createTicketPdf } from "@/lib/ticketing/ticket-pdf";
import { loadTicketPdfData } from "@/lib/ticketing/ticket-pdf-data";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  if (!admin) return new Response("Ticket download is unavailable", { status: 503 });
  const { data: order } = await admin.from("orders").select("id,order_number,public_token").eq("public_token", token).maybeSingle();
  if (!order) return new Response("Order not found", { status: 404 });
  const { data } = await admin.from("tickets").select("*").eq("order_id", order.id).order("ticket_number");
  const tickets = (data || []) as TicketRecord[];
  if (!tickets.length) return new Response("No tickets are available", { status: 404 });
  const pdfData = await loadTicketPdfData(admin, tickets, new URL(request.url).origin);
  const bytes = await createTicketPdf(pdfData);
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${order.order_number}-tickets.pdf"`, "Cache-Control": "private, no-store" } });
}
