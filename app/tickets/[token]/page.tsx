import QRCode from "qrcode";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, TicketCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function PublicTicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const admin = createAdminClient(); if (!admin) notFound();
  const { data: ticket } = await admin.from("tickets").select("*").eq("verification_token", token).maybeSingle(); if (!ticket) notFound();
  const [{ data: event }, { data: type }] = await Promise.all([admin.from("events").select("title,date,venue,address,city").eq("id", ticket.event_id).single(), admin.from("ticket_types").select("name").eq("id", ticket.ticket_type_id).single()]);
  if (!event || !type) notFound(); const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"; const qr = await QRCode.toDataURL(`${origin.replace(/\/$/, "")}/tickets/${token}`, { width: 520, margin: 2, errorCorrectionLevel: "H", color: { dark: "#05070b", light: "#ffffff" } });
  const label = ticket.status === "active" ? "VALID TICKET" : ticket.status === "used" ? "USED" : ticket.status.toUpperCase();
  return <main className="public-ticket-page"><article className={`digital-ticket status-${ticket.status}`}><header><span>GOOM</span><small>EVENT PRODUCTION</small></header><div className="digital-ticket-event"><p>Admission ticket</p><h1>{event.title}</h1><div><span><CalendarDays />{event.date ? new Intl.DateTimeFormat("en-CA", { dateStyle: "full", timeStyle: "short", timeZone: "America/Toronto" }).format(new Date(event.date)) : "Date to be announced"}</span><span><MapPin />{[event.venue, event.address, event.city].filter(Boolean).join(" · ")}</span></div></div><div className="ticket-qr"><Image src={qr} width={520} height={520} unoptimized alt={`QR code for ticket ${ticket.ticket_number}`} /><strong><TicketCheck />{label}</strong></div><dl><div><dt>Ticket type</dt><dd>{type.name}</dd></div><div><dt>Ticket number</dt><dd>{ticket.ticket_number}</dd></div><div><dt>Attendee</dt><dd>{ticket.attendee_name || "Guest"}</dd></div></dl><footer>Present this individual QR at the entrance. Do not share it publicly.</footer></article></main>;
}
