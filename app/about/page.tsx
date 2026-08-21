import Image from "next/image";
import { CTASection } from "@/components/CTASection";
import { PageHero } from "@/components/PageHero";

export const metadata = { title: "About", description: "Meet GOOM Event Production in Niagara, Ontario." };
export default function AboutPage() {
  return <main><PageHero eyebrow="About GOOM" title="Entertainment with intention." text="We believe the best events feel electric in the moment and effortless in the memory." image="/images/concerts.jpg" imageAlt="Audience and artist sharing a live concert moment" /><section className="about-story inner-section"><div className="about-image"><Image src="/images/production.jpg" alt="Professional live event stage production" fill sizes="(max-width: 800px) 100vw, 50vw" /></div><div><p className="section-eyebrow dark"><span />Our approach</p><h2>Local insight.<br />Big-stage thinking.</h2><p>Based in Niagara, GOOM brings together music, hospitality and technical production under one roof. We listen first, plan carefully and build every event around the people it is meant to move.</p><p>Whether it is a packed concert, an elegant wedding or a company celebration, our goal stays the same: create an atmosphere people remember.</p><div className="stats"><div><strong>01</strong><span>Creative vision</span></div><div><strong>02</strong><span>Technical precision</span></div><div><strong>03</strong><span>Genuine hospitality</span></div></div></div></section><CTASection /></main>;
}
