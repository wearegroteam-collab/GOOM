import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { EventHeroMedia } from "@/components/EventHeroMedia";
import { ResponsiveVideo } from "@/components/ResponsiveVideo";
import { ShowpassWidget } from "@/components/ShowpassWidget";
import { parseShowpassWidgetCode } from "@/lib/showpass";
import { getEventVideos, getPublishedEventBySlug } from "@/lib/site-data";
import { createClient } from "@/lib/supabase/server";
import { TicketSelector } from "@/components/ticketing/TicketSelector";
import type { TicketTypeRecord } from "@/lib/supabase/types";
import { publicAvailabilityStatus } from "@/lib/ticketing/core";
import { effectiveServiceFee, serviceFeeFromSettings } from "@/lib/ticketing/service-fee";
import { createAdminClient } from "@/lib/supabase/admin";

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
  await createAdminClient()?.rpc("release_expired_ticket_reservations");
  const supabase = await createClient();
  const [{ data: ticketData }, { data: feeSettingsData }] = event.sales_enabled && supabase
    ? await Promise.all([
      supabase.from("ticket_types").select("*").eq("event_id", event.id).eq("active", true).order("sort_order", { ascending: true }),
      supabase.from("site_settings").select("key,value").in("key", ["service_fee_enabled", "service_fee_type", "service_fee_value"]),
    ])
    : [{ data: [] }, { data: [] }];
  const ticketTypes = ((ticketData || []) as TicketTypeRecord[]).filter((ticket) => publicAvailabilityStatus(ticket) !== "hidden");
  const globalFee = serviceFeeFromSettings(Object.fromEntries((feeSettingsData || []).map((setting) => [setting.key, setting.value])));
  const serviceFee = effectiveServiceFee(event, globalFee);
  // Events created before the hero selector existed automatically promote
  // their first video. Once an administrator saves an explicit choice, that
  // image/video preference is respected.
  const useVideoHero = videos.length > 0 && (event.hero_media_type === "video" || event.hero_media_explicit !== true);
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
      {event.sales_enabled && ticketTypes.length > 0 && <section className="event-ticket-section goom-ticketing-section inner-section"><TicketSelector eventId={event.id} ticketTypes={ticketTypes} nowIso={new Date().toISOString()} serviceFee={serviceFee} /></section>}
      {event.info_banner_url && <section className="event-info-banner-section" aria-label={`${event.title} additional information`}>
        <div className="event-info-banner"><Image src={event.info_banner_url} alt={`${event.title} event information`} fill sizes="(max-width: 767px) 100vw, 1240px" /></div>
      </section>}
      {secondaryVideos.length > 0 && <section className="event-media-section inner-section">
        <div className="event-section-intro"><p className="section-eyebrow"><span />Promotional media</p><h2>Watch the <em>experience.</em></h2></div>
        <div className={`event-video-grid event-video-count-${Math.min(secondaryVideos.length, 3)}`}>{secondaryVideos.map((video, index) => <ResponsiveVideo key={video.id} video={video} title={`${event.title} promotional video ${index + 1}`} />)}</div>
      </section>}
      {showpassConfig && ticketTypes.length === 0 && <section className="event-ticket-section inner-section">
        <div className="event-section-intro"><p className="section-eyebrow dark"><span />Official ticketing</p><h2>Get your <em>tickets.</em></h2><p>Choose your tickets securely through Showpass without leaving the event experience.</p></div>
        <div className="showpass-shell"><ShowpassWidget config={showpassConfig} title={event.title} /></div>
        {event.ticket_url && <a href={event.ticket_url} target="_blank" rel="noreferrer" className="outline-link">Open ticket page instead</a>}
      </section>}
    </main>
  );
}
