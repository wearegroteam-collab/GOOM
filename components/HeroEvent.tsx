import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin } from "lucide-react";
import type { EventRecord } from "@/lib/supabase/types";

function heroDate(date: string | null) {
  if (!date) return { long: "Date to be announced", day: "—", month: "TBA" };
  const value = new Date(date);
  return {
    long: new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Toronto" }).format(value),
    day: new Intl.DateTimeFormat("en-CA", { day: "2-digit", timeZone: "America/Toronto" }).format(value),
    month: new Intl.DateTimeFormat("en-CA", { month: "short", timeZone: "America/Toronto" }).format(value).toUpperCase(),
  };
}

export function HeroEvent({ event }: { event: EventRecord }) {
  const date = heroDate(event.date);
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="section-eyebrow"><span />GOOM presents</p>
        <p className="event-type">{event.subtitle || "Live Event"}</p>
        <h1>{event.title.split(" ")[0]}<br /><em>{event.title.split(" ").slice(1).join(" ") || "Live"}</em></h1>
        <div className="event-meta">
          <div><small>Date</small><strong>{date.long}</strong></div>
          <div><small>Venue</small><strong>{event.venue || "Venue to be announced"}</strong></div>
        </div>
        {(event.address || event.city) && <p className="address"><MapPin size={14} aria-hidden="true" />{[event.address, event.city].filter(Boolean).join(", ")}</p>}
        <p className="hero-description">{event.description}</p>
        <div className="hero-actions">
          {event.ticket_url && <a className="button" href={event.ticket_url} target="_blank" rel="noreferrer">Buy tickets <ArrowUpRight size={16} /></a>}
          <Link className="text-link" href="/contact">Plan your event <ArrowRight size={16} /></Link>
        </div>
      </div>
      <div className="hero-art">
        <Image priority src={event.image_url || "/images/concert-hero.jpg"} alt={`${event.title} live event`} fill sizes="(max-width: 850px) 100vw, 50vw" />
        <div className="hero-art-overlay" />
        <div className="art-label"><span>{event.city || "Niagara"}</span><strong>One night.<br />Live & loud.</strong></div>
        <div className="date-badge"><strong>{date.day}</strong><span>{date.month}</span></div>
      </div>
    </section>
  );
}
