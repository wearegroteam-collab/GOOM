import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import type { EventRecord } from "@/lib/supabase/types";

function formatDate(date: string | null) {
  if (!date) return "Coming soon";
  return new Intl.DateTimeFormat("en-CA", { month: "long", day: "numeric", timeZone: "America/Toronto" }).format(new Date(date));
}

export function EventCard({ event }: { event: EventRecord }) {
  const canBuy = event.status === "published" && Boolean(event.ticket_url);
  const href = canBuy ? event.ticket_url! : `/events/${event.slug}`;
  const label = canBuy ? "Buy tickets" : event.status === "past" ? "View event" : "View event";
  return (
    <article className="event-card">
      <Link href={href} className="event-card-image" aria-label={`${label}: ${event.title}`} target={canBuy ? "_blank" : undefined} rel={canBuy ? "noreferrer" : undefined}>
        <Image src={event.image_url || "/images/stage.jpg"} alt={`${event.title} — ${event.subtitle || "GOOM event"}`} fill sizes="(max-width: 760px) 84vw, 33vw" />
        <span className={`status status-${event.status === "published" ? "available" : "past"}`}>{event.status === "published" ? "Available" : "Past event"}</span>
      </Link>
      <div className="event-card-body">
        <p className="event-date">{formatDate(event.date)}</p>
        <p className="event-kicker">{event.subtitle || "GOOM Event"}</p>
        <h3>{event.title}</h3>
        <p className="event-location"><MapPin size={14} aria-hidden="true" /> {event.city || "Niagara Region"}</p>
        <Link className="event-link" href={href} target={canBuy ? "_blank" : undefined} rel={canBuy ? "noreferrer" : undefined}>
          {label} <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
