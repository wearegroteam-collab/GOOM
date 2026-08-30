import Link from "next/link";
import { CalendarDays, Images, PanelsTopLeft, Settings, ShoppingBag, Sparkles } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { createClient } from "@/lib/supabase/server";
import type { EventRecord } from "@/lib/supabase/types";

export default async function AdminDashboard() {
  const supabase = await createClient();
  let events: EventRecord[] = [];
  if (supabase) {
    const { data } = await supabase.from("events").select("*").order("created_at", { ascending: false });
    events = (data || []) as EventRecord[];
  }
  // Server-rendered request time is intentional for the live upcoming-event count.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const stats = {
    upcoming: events.filter((event) => event.status === "published" && event.date && new Date(event.date).getTime() >= now).length,
    published: events.filter((event) => event.status === "published").length,
    drafts: events.filter((event) => event.status === "draft").length,
  };
  const areas = [
    ["Home banners", "Upload responsive artwork for the home carousel", "/admin/home-banners", PanelsTopLeft],
    ["Events", "Create, publish and feature events", "/admin/events", CalendarDays],
    ["Orders", "Manage ticket sales, guests and refunds", "/admin/orders", ShoppingBag],
    ["Services", "Manage the services shown publicly", "/admin/services", Sparkles],
    ["Gallery", "Upload and curate event imagery", "/admin/gallery", Images],
    ["Settings", "Contact details and social links", "/admin/settings", Settings],
  ] as const;
  return <><AdminPageHeader eyebrow="Dashboard" title="Content overview" description="Manage what visitors see across the GOOM website." /><section className="admin-stats"><div><span>Upcoming events</span><strong>{stats.upcoming}</strong></div><div><span>Published events</span><strong>{stats.published}</strong></div><div><span>Draft events</span><strong>{stats.drafts}</strong></div></section><section className="admin-area-grid">{areas.map(([title, description, href, Icon]) => <Link key={href} href={href}><Icon /><div><h2>{title}</h2><p>{description}</p></div><span>Open →</span></Link>)}</section>{!supabase && <div className="admin-setup-note"><strong>Supabase setup pending</strong><p>Add the environment variables and run the provided SQL to connect this dashboard.</p></div>}</>;
}
