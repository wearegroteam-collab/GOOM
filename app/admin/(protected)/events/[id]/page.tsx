import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EventForm } from "@/components/admin/EventForm";
import { createClient } from "@/lib/supabase/server";
import type { EventRecord } from "@/lib/supabase/types";
export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const supabase = await createClient(); if (!supabase) notFound(); const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle(); if (!data) notFound(); const event = data as EventRecord; return <><AdminPageHeader eyebrow="Events" title={`Edit ${event.title}`} description="Update event details, publication status and ticket destination." /><EventForm event={event} /></>; }
