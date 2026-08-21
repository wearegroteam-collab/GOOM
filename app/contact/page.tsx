import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { getSiteSettings } from "@/lib/site-data";

export const metadata = { title: "Contact", description: "Plan your Niagara event with GOOM." };
export default async function ContactPage() {
  const settings = await getSiteSettings();
  return <main><PageHero eyebrow="Start a conversation" title="Tell us what you're planning." text="Share the idea, the date and the feeling you want to create. We will help shape the rest." image="/images/wedding.jpg" imageAlt="Warm event celebration prepared by GOOM" /><section className="contact-grid inner-section"><div className="contact-intro"><h2>Let&apos;s create something people will talk about.</h2><p>We produce concerts, weddings, private celebrations and corporate events across Niagara and surrounding areas.</p></div><div className="contact-options">{settings.phone && <a href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`}><Phone /><span><small>Call us</small>{settings.phone}</span></a>}{settings.whatsapp && <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}><MessageCircle /><span><small>WhatsApp</small>Start a conversation</span></a>}{settings.email && <a href={`mailto:${settings.email}`}><Mail /><span><small>Email</small>{settings.email}</span></a>}<div><MapPin /><span><small>Based in</small>Niagara, Ontario, Canada</span></div></div></section></main>;
}
