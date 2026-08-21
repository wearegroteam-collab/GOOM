import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EventForm } from "@/components/admin/EventForm";
import { createClient } from "@/lib/supabase/server";
import type { EventRecord, EventVideoRecord } from "@/lib/supabase/types";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const [{ data }, { data: videoData }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).maybeSingle(),
    supabase.from("event_videos").select("*").eq("event_id", id).order("sort_order"),
  ]);
  if (!data) notFound();
  const event = data as EventRecord;
  return <>
    <AdminPageHeader eyebrow="Events" title={`Edit ${event.title}`} description="Update event details, ticketing, promotional media and publication status." />
    <EventForm event={event} eventVideos={(videoData || []) as EventVideoRecord[]} />
  </>;
}
