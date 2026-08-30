import { createAdminClient } from "@/lib/supabase/admin";
import type { TicketRecord } from "@/lib/supabase/types";
import { createTicketPdf } from "@/lib/ticketing/ticket-pdf";
import { loadTicketPdfData } from "@/lib/ticketing/ticket-pdf-data";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  if (!admin) return new Response("Ticket download is unavailable", { status: 503 });
  const { data } = await admin.from("tickets").select("*").eq("verification_token", token).maybeSingle();
  if (!data) return new Response("Ticket not found", { status: 404 });
  const ticket = data as TicketRecord;
  const pdfData = await loadTicketPdfData(admin, [ticket], new URL(request.url).origin);
  const bytes = await createTicketPdf(pdfData);
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${ticket.ticket_number}-ticket.pdf"`, "Cache-Control": "private, no-store" } });
}
