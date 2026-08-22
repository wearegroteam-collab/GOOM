"use client";

import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { ResponsiveVideo } from "@/components/ResponsiveVideo";
import { normalizeVideoInput } from "@/lib/event-video";
import type { EventRecord, EventVideoRecord, HeroMediaType, VideoAspectRatio } from "@/lib/supabase/types";
import { deleteEvent, saveEvent } from "@/app/admin/(protected)/events/actions";

function inputDate(value: string | null | undefined) { return value ? new Date(value).toISOString().slice(0, 16) : ""; }

type VideoDraft = { key: string; url: string; aspect_ratio: VideoAspectRatio };

export function EventForm({ event, eventVideos = [] }: { event?: EventRecord; eventVideos?: EventVideoRecord[] }) {
  const action = saveEvent.bind(null, event?.id || null);
  const [state, formAction, pending] = useActionState(action, { error: "" });
  const deleteAction = event ? deleteEvent.bind(null, event.id, event.image_url, event.info_banner_url || null) : undefined;
  const [videos, setVideos] = useState<VideoDraft[]>(eventVideos.map((video) => ({ key: video.id, url: video.url, aspect_ratio: video.aspect_ratio })));
  const [heroMediaType, setHeroMediaType] = useState<HeroMediaType>(event?.hero_media_type || "image");

  function updateVideo(key: string, changes: Partial<VideoDraft>) {
    setVideos((items) => items.map((item) => item.key === key ? { ...item, ...changes } : item));
  }

  return <form action={formAction} className="admin-editor" encType="multipart/form-data">
    <input type="hidden" name="current_image_url" value={event?.image_url || ""} />
    <input type="hidden" name="current_info_banner_url" value={event?.info_banner_url || ""} />
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
      <label className="full">Hero Media<select name="hero_media_type" value={heroMediaType} onChange={(event) => setHeroMediaType(event.target.value as HeroMediaType)}><option value="image">Use the event image</option><option value="video">Use the first promotional video</option></select><small>{heroMediaType === "video" ? "The first valid video below will appear in the event hero. Browser autoplay normally starts muted; Instagram may require the visitor to press play." : "The event image will appear in the hero. All promotional videos stay in the media section below."}</small></label>
      <label className="full">Information Banner<input name="info_banner" type="file" accept="image/*" /><small>{event?.info_banner_url ? "Upload a new banner to replace the current one. Recommended format: 1920 × 600 px." : "Optional image displayed below the event introduction. Recommended format: 1920 × 600 px."}</small></label>
      {event?.info_banner_url && <label className="admin-check full"><input name="remove_info_banner" type="checkbox" />Remove current information banner</label>}

      <fieldset className="admin-event-section full">
        <legend>Ticketing</legend>
        <label>Ticket URL<input name="ticket_url" type="url" defaultValue={event?.ticket_url || ""} placeholder="https://…" /><small>Optional external purchase link and widget fallback.</small></label>
        <label>Showpass Widget Code<textarea name="showpass_widget_code" rows={9} defaultValue={event?.showpass_widget_code || ""} placeholder={'<script>showpass.tickets.eventPurchaseWidget("event-slug", {}, "container-id");</script>'} /><small>Paste the official Showpass widget/embed code. Only official Showpass resources are accepted.</small></label>
      </fieldset>

      <fieldset className="admin-event-section full">
        <legend>Promotional Video</legend>
        <div className="admin-section-heading"><p>Add YouTube, Vimeo, Instagram Reel/Post, HTTPS embeds or externally hosted MP4 files. {heroMediaType === "video" ? "The first video is used in the hero; the rest appear below." : "All videos appear in the promotional section below."}</p><button type="button" className="admin-secondary-button" disabled={videos.length >= 8} onClick={() => setVideos((items) => [...items, { key: crypto.randomUUID(), url: "", aspect_ratio: "auto" }])}><Plus size={14} />Add video</button></div>
        {videos.length === 0 && <div className="admin-media-empty">No promotional videos added.</div>}
        <div className="admin-video-list">
          {videos.map((video, index) => {
            const preview = normalizeVideoInput(video.url, video.aspect_ratio);
            return <div className="admin-video-row" key={video.key}>
              <div className="admin-video-fields">
                <label>{heroMediaType === "video" && index === 0 ? "Hero video" : `Promotional video ${index + 1}`} URL or iframe<textarea name="video_url" rows={3} value={video.url} onChange={(event) => updateVideo(video.key, { url: event.target.value })} placeholder="YouTube, Vimeo, Instagram or HTTPS MP4 link" /></label>
                <label>Format<select name="video_aspect_ratio" value={video.aspect_ratio} onChange={(event) => updateVideo(video.key, { aspect_ratio: event.target.value as VideoAspectRatio })}><option value="auto">Auto</option><option value="16:9">16:9 horizontal</option><option value="9:16">9:16 vertical</option><option value="4:5">4:5 portrait</option><option value="1:1">1:1 square</option></select></label>
                <button type="button" className="admin-danger-button" onClick={() => setVideos((items) => items.filter((item) => item.key !== video.key))}><Trash2 size={14} />Remove</button>
              </div>
              {preview && <div className="admin-video-preview"><span>{preview.provider} preview</span><ResponsiveVideo video={preview} title={`Promotional video ${index + 1} preview`} compact /></div>}
            </div>;
          })}
        </div>
      </fieldset>

      <label>Status<select name="status" defaultValue={event?.status || "draft"}><option value="draft">Draft</option><option value="published">Published</option><option value="past">Past</option></select></label>
      <label className="admin-check"><input name="featured" type="checkbox" defaultChecked={event?.featured} />Featured Event</label>
    </div>
    {state.error && <p className="admin-form-error" role="alert">{state.error}</p>}
    <div className="admin-form-actions"><button className="admin-primary-button" disabled={pending} type="submit">{pending ? "Saving…" : "Save"}</button>{event && <Link className="admin-secondary-button" href={`/events/${event.slug}`} target="_blank">Preview</Link>}{event && deleteAction && <button className="admin-danger-button" formAction={deleteAction} type="submit">Delete</button>}</div>
  </form>;
}
