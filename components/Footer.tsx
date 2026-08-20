import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "./Logo";
import { getSiteSettings } from "@/lib/site-data";

export async function Footer() {
  const settings = await getSiteSettings();
  const links = [["Home", "/"], ["Events", "/events"], ["Services", "/services"], ["Gallery", "/gallery"], ["About", "/about"], ["Contact", "/contact"]];
  const social = [["Instagram", settings.instagram], ["Facebook", settings.facebook], ["TikTok", settings.tiktok], ["YouTube", settings.youtube]].filter(([, href]) => href);
  return (
    <footer className="site-footer">
      <div className="footer-lead"><Logo /><p>Creating unforgettable experiences through music, production and entertainment.</p></div>
      <div className="footer-nav"><p>Quick links</p>{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div>
      <div className="footer-social"><p>Follow the energy</p>{social.map(([item, href]) => <a key={item} href={href} target="_blank" rel="noreferrer">{item}<ArrowUpRight size={13} /></a>)}</div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} GOOM Event Production.</span><span>Niagara, Ontario · Canada</span></div>
    </footer>
  );
}
