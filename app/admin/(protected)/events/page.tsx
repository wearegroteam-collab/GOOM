import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { createClient } from "@/lib/supabase/server";
import type { EventRecord } from "@/lib/supabase/types";

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string }> }) {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("events").select("*").order("date", { ascending: false, nullsFirst: false }) : { data: [] };
  const events = (data || []) as EventRecord[];
  const params = await searchParams;
  return <><AdminPageHeader eyebrow="Content" title="Events" description="Manage upcoming, published and past events." action={<Link className="admin-primary-button" href="/admin/events/new">New event</Link>} />{(params.saved || params.deleted) && <p className="admin-success">{params.saved ? "Event saved." : "Event deleted."}</p>}<div className="admin-table"><div className="admin-table-head"><span>Event</span><span>Date</span><span>Status</span><span>Featured</span><span /></div>{events.map(event => <div className="admin-table-row" key={event.id}><div><strong>{event.title}</strong><small>{event.subtitle || event.slug}</small></div><span>{event.date ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(event.date)) : "TBA"}</span><span><i className={`admin-status ${event.status}`}>{event.status}</i></span><span>{event.featured ? "Yes" : "—"}</span><Link href={`/admin/events/${event.id}`}>Edit →</Link></div>)}{!events.length && <div className="admin-empty"><strong>No events yet</strong><p>Create your first event or run the seed SQL.</p></div>}</div></>;
}
