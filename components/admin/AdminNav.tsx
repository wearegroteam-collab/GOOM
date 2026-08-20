import Link from "next/link";
import { CalendarDays, Images, LayoutDashboard, LogOut, Settings, Sparkles } from "lucide-react";
import { logout } from "@/app/admin/(protected)/actions";

const links = [
  ["Overview", "/admin", LayoutDashboard],
  ["Events", "/admin/events", CalendarDays],
  ["Services", "/admin/services", Sparkles],
  ["Gallery", "/admin/gallery", Images],
  ["Settings", "/admin/settings", Settings],
] as const;

export function AdminNav({ email }: { email?: string }) {
  return (
    <aside className="admin-sidebar">
      <Link href="/admin" className="admin-logo">GOOM<span>CONTENT STUDIO</span></Link>
      <nav aria-label="Administration">{links.map(([label, href, Icon]) => <Link key={href} href={href}><Icon size={17} />{label}</Link>)}</nav>
      <div className="admin-account"><span>Signed in as</span><strong>{email || "Administrator"}</strong><form action={logout}><button type="submit"><LogOut size={15} />Sign out</button></form></div>
    </aside>
  );
}
