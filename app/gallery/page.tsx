import { GalleryGrid } from "@/components/GalleryGrid";
import { PageHero } from "@/components/PageHero";
import { getGalleryItems } from "@/lib/site-data";

export const metadata = { title: "Gallery", description: "Past GOOM events, celebrations and productions." };
export default async function GalleryPage() { const items = await getGalleryItems(); return <main><PageHero eyebrow="Past events" title="Seen. Heard. Felt." text="A glimpse of the stages, celebrations and shared moments that define GOOM." image="/images/crowd.jpg" imageAlt="Crowd enjoying a colorful live event" /><section className="inner-section gallery-page-section"><GalleryGrid full items={items} /></section></main>; }
