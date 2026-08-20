import Link from "next/link";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { getSiteSettings } from "@/lib/site-data";

export async function CTASection() {
  const settings = await getSiteSettings();
  return (
    <section className="cta-section">
      <p className="section-eyebrow"><span />Your moment. Our production.</p>
      <h2>Let&apos;s make your next<br />event <em>unforgettable.</em></h2>
      <p>Planning a wedding, private party, corporate event or special celebration? Let GOOM bring your idea to life.</p>
      <Link className="button button-dark" href="/contact">Get a free quote <span>↗</span></Link>
      <div className="quick-links">
        {settings.phone && <a href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`}><Phone size={17} aria-hidden="true" />Call us</a>}
        {settings.whatsapp && <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}><MessageCircle size={17} aria-hidden="true" />WhatsApp</a>}
        {settings.email && <a href={`mailto:${settings.email}`}><Mail size={17} aria-hidden="true" />Email</a>}
      </div>
    </section>
  );
}
