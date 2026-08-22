import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { CTASection } from "@/components/CTASection";
import { EventCard } from "@/components/EventCard";
import { GalleryGrid } from "@/components/GalleryGrid";
import { HeroSlider } from "@/components/HeroSlider";
import { SectionTitle } from "@/components/SectionTitle";
import { ServiceCard } from "@/components/ServiceCard";
import { heroSlides } from "@/data/heroSlides";
import { getActiveServices, getGalleryItems, getHomeBanners, getPublishedEvents } from "@/lib/site-data";

export default async function Home() {
  const [events, services, gallery, banners] = await Promise.all([
    getPublishedEvents(), getActiveServices(), getGalleryItems(true), getHomeBanners(),
  ]);
  const slides = banners.length ? banners.map((banner) => ({
    id: banner.id,
    title: banner.title,
    desktopImage: banner.desktop_image_url,
    tabletImage: banner.tablet_image_url || banner.desktop_image_url,
    mobileImage: banner.mobile_image_url || banner.tablet_image_url || banner.desktop_image_url,
    alt: banner.alt_text,
    ticketUrl: banner.button_url || undefined,
    buttonLabel: banner.button_label || undefined,
    contactUrl: "/contact",
    active: banner.active,
    sortOrder: banner.sort_order,
  })) : heroSlides;
  return (
    <main>
      <HeroSlider slides={slides} />
      <section className="intro-section content-section">
        <div className="intro-number">GOOM<span>EST. NIAGARA</span></div>
        <div className="intro-copy">
          <p className="section-eyebrow dark"><span />Who we are</p>
          <h2>We create<br /><em>experiences.</em></h2>
          <p>GOOM Event Production creates memorable experiences through live entertainment, music, event production, catering and private celebrations across Niagara and surrounding areas.</p>
        </div>
        <div className="highlights">
          {["Professional Production", "Memorable Experiences", "Passion for Entertainment"].map(item => <p key={item}><CircleCheck size={18} strokeWidth={1.5} />{item}</p>)}
        </div>
      </section>

      <section className="services-section content-section" id="services">
        <SectionTitle eyebrow="Our services" title="Every detail. One team." intro="From the first idea to the final song, we shape events that look effortless and feel unforgettable." />
        <div className="services-grid">{services.map((service, index) => <ServiceCard key={service.id} service={service} index={index} />)}</div>
        <Link className="outline-link" href="/services">Explore all services <ArrowRight size={16} /></Link>
      </section>

      <section className="events-section content-section">
        <SectionTitle eyebrow="Upcoming events" title="Meet us under the lights." intro="Discover GOOM-produced nights and live entertainment across Niagara." light />
        <div className="events-grid">{events.map(event => <EventCard key={event.id} event={event} />)}</div>
      </section>

      <section className="gallery-section content-section">
        <SectionTitle eyebrow="Gallery / Past events" title="The moments speak for themselves." />
        <GalleryGrid items={gallery.slice(0, 6)} />
        <Link className="outline-link" href="/gallery">View full gallery <ArrowRight size={16} /></Link>
      </section>
      <CTASection />
    </main>
  );
}
