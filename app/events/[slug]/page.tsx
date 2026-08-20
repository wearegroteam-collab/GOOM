import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { getPublishedEventBySlug } from "@/lib/site-data";

type Props = { params: Promise<{ slug: string }> };

function eventDate(date: string | null) {
  if (!date) return "Date to be announced";
  return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/Toronto" }).format(new Date(date));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublishedEventBySlug(slug);
  if (!event) return { title: "Event not found" };
  const description = `${eventDate(event.date)}${event.venue ? ` at ${event.venue}` : ""}.`;
  return {
    title: `${event.title} — ${event.subtitle || "GOOM Event"}`,
    description,
    openGraph: { title: `${event.title} — ${event.subtitle || "GOOM Event"}`, description, images: event.image_url ? [event.image_url] : [] },
    twitter: { card: "summary_large_image", title: `${event.title} — ${event.subtitle || "GOOM Event"}`, description, images: event.image_url ? [event.image_url] : [] },
  };
}

export default async function EventDetailPage({ params }: Props) {
  const { slug } = await params;
  const event = await getPublishedEventBySlug(slug);
  if (!event) notFound();
  const name = event.title.split(" ");
  return (
    <main className="event-detail">
      <section className="event-detail-hero">
        <div className="detail-image"><Image priority src={event.image_url || "/images/concert-hero.jpg"} alt={`${event.title} live event`} fill sizes="(max-width: 850px) 100vw, 50vw" /></div>
        <div className="detail-copy">
          <p className="section-eyebrow"><span />GOOM presents</p>
          <p>{event.subtitle || "Live Event"}</p>
          <h1>{name[0]}<br /><em>{name.slice(1).join(" ") || "Live"}</em></h1>
          <div className="detail-facts">
            <p><CalendarDays />{eventDate(event.date)}</p>
            <p><MapPin />{event.venue || "Venue to be announced"}<br /><span>{[event.address, event.city].filter(Boolean).join(", ")}</span></p>
          </div>
          <p className="detail-description">{event.description}</p>
          {event.ticket_url && <a href={event.ticket_url} target="_blank" rel="noreferrer" className="button">Buy tickets</a>}
        </div>
      </section>
      {!event.ticket_url && <section className="event-note inner-section"><p className="section-eyebrow dark"><span />Ticket information</p><h2>Tickets are coming soon.</h2><p>Online ticket sales will be announced by GOOM.</p></section>}
    </main>
  );
}
