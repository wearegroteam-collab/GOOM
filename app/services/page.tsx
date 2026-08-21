import { CTASection } from "@/components/CTASection";
import { PageHero } from "@/components/PageHero";
import { ServiceCard } from "@/components/ServiceCard";
import { getActiveServices } from "@/lib/site-data";

export const metadata = { title: "Services", description: "Event production, entertainment, DJ, catering and celebrations in Niagara." };
export default async function ServicesPage() { const services = await getActiveServices(); return <main><PageHero eyebrow="What we do" title="Built around your moment." text="One experienced team for entertainment, production and hospitality — scaled to fit your event." image="/images/production.jpg" imageAlt="Professional event production lighting and staging" /><section className="inner-section services-page-section"><div className="services-grid services-grid-full">{services.map((service, index) => <ServiceCard key={service.id} service={service} index={index} />)}</div></section><CTASection /></main>; }
