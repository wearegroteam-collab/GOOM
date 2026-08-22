import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { EventHeroMedia } from "@/components/EventHeroMedia";
import { ResponsiveVideo } from "@/components/ResponsiveVideo";
import { ShowpassWidget } from "@/components/ShowpassWidget";
import { parseShowpassWidgetCode } from "@/lib/showpass";
import { getEventVideos, getPublishedEventBySlug } from "@/lib/site-data";

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
  const videos = await getEventVideos(event.id);
  const useVideoHero = event.hero_media_type === "video" && videos.length > 0;
  const heroVideo = useVideoHero ? videos[0] : undefined;
  const secondaryVideos = useVideoHero ? videos.slice(1) : videos;
  const showpassConfig = parseShowpassWidgetCode(event.showpass_widget_code);
  const name = event.title.split(" ");
  return (
    <main className="event-detail">
      <section className="event-detail-hero">
        <EventHeroMedia video={heroVideo} poster={event.image_url || "/images/concert-hero.jpg"} title={event.title} />
        <div className="detail-copy">
          <p className="section-eyebrow"><span />GOOM presents</p>
          <p>{event.subtitle || "Live Event"}</p>
          <h1>{name[0]}<br /><em>{name.slice(1).join(" ") || "Live"}</em></h1>
          <div className="detail-facts">
            <p><CalendarDays />{eventDate(event.date)}</p>
            <p><MapPin />{event.venue || "Venue to be announced"}<br /><span>{[event.address, event.city].filter(Boolean).join(", ")}</span></p>
          </div>
          <p className="detail-description">{event.description}</p>
          {event.ticket_url && !showpassConfig && <a href={event.ticket_url} target="_blank" rel="noreferrer" className="button">Buy tickets</a>}
        </div>
      </section>
      {event.info_banner_url && <section className="event-info-banner-section" aria-label={`${event.title} additional information`}>
        <div className="event-info-banner"><Image src={event.info_banner_url} alt={`${event.title} event information`} fill sizes="(max-width: 767px) 100vw, 1240px" /></div>
      </section>}
      {secondaryVideos.length > 0 && <section className="event-media-section inner-section">
        <div className="event-section-intro"><p className="section-eyebrow"><span />Promotional media</p><h2>Watch the <em>experience.</em></h2></div>
        <div className={`event-video-grid event-video-count-${Math.min(secondaryVideos.length, 3)}`}>{secondaryVideos.map((video, index) => <ResponsiveVideo key={video.id} video={video} title={`${event.title} promotional video ${index + 1}`} />)}</div>
      </section>}
      {showpassConfig && <section className="event-ticket-section inner-section">
        <div className="event-section-intro"><p className="section-eyebrow dark"><span />Official ticketing</p><h2>Get your <em>tickets.</em></h2><p>Choose your tickets securely through Showpass without leaving the event experience.</p></div>
        <div className="showpass-shell"><ShowpassWidget config={showpassConfig} title={event.title} /></div>
        {event.ticket_url && <a href={event.ticket_url} target="_blank" rel="noreferrer" className="outline-link">Open ticket page instead</a>}
      </section>}
    </main>
  );
}
