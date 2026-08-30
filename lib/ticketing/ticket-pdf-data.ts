import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TicketRecord } from "@/lib/supabase/types";
import type { TicketPdfData } from "./ticket-pdf";

export async function loadTicketPdfData(admin: SupabaseClient<Database>, tickets: TicketRecord[], origin: string): Promise<TicketPdfData[]> {
  if (!tickets.length) return [];
  const eventIds = [...new Set(tickets.map((ticket) => ticket.event_id))];
  const typeIds = [...new Set(tickets.map((ticket) => ticket.ticket_type_id))];
  const [{ data: events }, { data: types }] = await Promise.all([
    admin.from("events").select("id,title,date,venue,address,city").in("id", eventIds),
    admin.from("ticket_types").select("id,name").in("id", typeIds),
  ]);
  const eventMap = new Map((events || []).map((event) => [event.id, event]));
  const typeMap = new Map((types || []).map((type) => [type.id, type.name]));
  return tickets.map((ticket) => {
    const event = eventMap.get(ticket.event_id);
    if (!event) throw new Error("Ticket event not found");
    return {
      eventName: event.title,
      eventDate: event.date,
      venue: event.venue,
      address: event.address,
      city: event.city,
      ticketType: typeMap.get(ticket.ticket_type_id) || "Event ticket",
      ticketNumber: ticket.ticket_number,
      attendeeName: ticket.attendee_name,
      status: ticket.status,
      qrUrl: `${origin.replace(/\/$/, "")}/tickets/${ticket.verification_token}`,
    };
  });
}
