import { EventCard } from "@/components/EventCard";
import { PageHero } from "@/components/PageHero";
import { getPublishedEvents } from "@/lib/site-data";

export const metadata = { title: "Events", description: "Upcoming and past GOOM events in Niagara." };
export default async function EventsPage() { const events = await getPublishedEvents(); return <main><PageHero eyebrow="GOOM events" title="Live nights. Real energy." text="Original productions, visiting artists and memorable nights created for Niagara." /><section className="inner-section"><div className="events-grid">{events.map(event => <EventCard key={event.id} event={event} />)}</div></section></main>; }
