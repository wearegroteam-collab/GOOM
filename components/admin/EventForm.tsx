"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { EventRecord } from "@/lib/supabase/types";
import { deleteEvent, saveEvent } from "@/app/admin/(protected)/events/actions";

function inputDate(value: string | null | undefined) { return value ? new Date(value).toISOString().slice(0, 16) : ""; }

export function EventForm({ event }: { event?: EventRecord }) {
  const action = saveEvent.bind(null, event?.id || null);
  const [state, formAction, pending] = useActionState(action, { error: "" });
  const deleteAction = event ? deleteEvent.bind(null, event.id, event.image_url) : undefined;
  return <form action={formAction} className="admin-editor" encType="multipart/form-data">
    <input type="hidden" name="current_image_url" value={event?.image_url || ""} />
    <div className="admin-form-grid">
      <label>Event Name<input name="title" defaultValue={event?.title} required /></label>
      <label>Subtitle<input name="subtitle" defaultValue={event?.subtitle || ""} /></label>
      <label className="full">Slug<input name="slug" defaultValue={event?.slug} pattern="[a-z0-9-]+" required /></label>
      <label className="full">Description<textarea name="description" rows={5} defaultValue={event?.description || ""} /></label>
      <label>Date<input name="date" type="datetime-local" defaultValue={inputDate(event?.date)} /></label>
      <label>Venue<input name="venue" defaultValue={event?.venue || ""} /></label>
      <label>Address<input name="address" defaultValue={event?.address || ""} /></label>
      <label>City<input name="city" defaultValue={event?.city || ""} /></label>
      <label className="full">Event Image<input name="image" type="file" accept="image/*" /><small>{event?.image_url ? "Upload a new image to replace the current one." : "JPG, PNG or WebP. Maximum 6 MB."}</small></label>
      <label className="full">Ticket URL<input name="ticket_url" type="url" defaultValue={event?.ticket_url || ""} placeholder="https://…" /><small>Leave empty to hide Buy Tickets.</small></label>
      <label>Status<select name="status" defaultValue={event?.status || "draft"}><option value="draft">Draft</option><option value="published">Published</option><option value="past">Past</option></select></label>
      <label className="admin-check"><input name="featured" type="checkbox" defaultChecked={event?.featured} />Featured Event</label>
    </div>
    {state.error && <p className="admin-form-error" role="alert">{state.error}</p>}
    <div className="admin-form-actions"><button className="admin-primary-button" disabled={pending} type="submit">{pending ? "Saving…" : "Save"}</button>{event && <Link className="admin-secondary-button" href={`/events/${event.slug}`} target="_blank">Preview</Link>}{event && deleteAction && <button className="admin-danger-button" formAction={deleteAction} type="submit">Delete</button>}</div>
  </form>;
}
