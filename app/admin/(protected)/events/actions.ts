"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { removeStoredImage, uploadImage } from "@/lib/admin/storage";
import { normalizeVideoInput } from "@/lib/event-video";
import { parseShowpassWidgetCode } from "@/lib/showpass";
import { createClient } from "@/lib/supabase/server";
import type { EventStatus, HeroMediaType } from "@/lib/supabase/types";

export type EventActionState = { error: string };

function validExternalUrl(value: string) {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

export async function saveEvent(id: string | null, _state: EventActionState, formData: FormData): Promise<EventActionState> {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured." };
  const title = String(formData.get("title") || "").trim();
  const slug = String(formData.get("slug") || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!title || !slug) return { error: "Event name and slug are required." };
  const status = String(formData.get("status") || "draft") as EventStatus;
  if (!["draft", "published", "past"].includes(status)) return { error: "Invalid event status." };

  const ticketUrl = String(formData.get("ticket_url") || "").trim();
  if (!validExternalUrl(ticketUrl)) return { error: "Ticket URL must be a valid HTTP or HTTPS address." };
  const showpassWidgetCode = String(formData.get("showpass_widget_code") || "").trim();
  if (showpassWidgetCode && !parseShowpassWidgetCode(showpassWidgetCode)) {
    return { error: "The Showpass code is invalid. Paste an official Showpass iframe, URL, or eventPurchaseWidget embed." };
  }

  const videoUrls = formData.getAll("video_url").map((value) => String(value).trim());
  const videoRatios = formData.getAll("video_aspect_ratio").map(String);
  const videoEntries = videoUrls.map((url, index) => ({ url, ratio: videoRatios[index] || "auto" })).filter((video) => video.url);
  if (videoEntries.length > 8) return { error: "A maximum of eight promotional videos is allowed." };
  const videos = videoEntries.map((video) => normalizeVideoInput(video.url, video.ratio));
  if (videos.some((video) => !video)) return { error: "One or more video URLs or embeds are invalid. Use HTTPS YouTube, Vimeo, Instagram, MP4, or iframe sources." };
  const heroMediaType = String(formData.get("hero_media_type") || "image") as HeroMediaType;
  if (!["image", "video"].includes(heroMediaType)) return { error: "Invalid hero media option." };
  if (heroMediaType === "video" && !videos.length) return { error: "Add at least one valid promotional video before selecting video for the event hero." };

  let imageUrl = String(formData.get("current_image_url") || "") || null;
  const previousBannerUrl = String(formData.get("current_info_banner_url") || "") || null;
  let infoBannerUrl = formData.get("remove_info_banner") === "on" ? null : previousBannerUrl;
  const image = formData.get("image");
  const infoBanner = formData.get("info_banner");
  try {
    if (image instanceof File && image.size) imageUrl = await uploadImage(supabase, "events", image);
    if (infoBanner instanceof File && infoBanner.size) infoBannerUrl = await uploadImage(supabase, "events", infoBanner);
  } catch (error) { return { error: error instanceof Error ? error.message : "Image upload failed." }; }

  const featured = formData.get("featured") === "on";
  if (featured) await supabase.from("events").update({ featured: false }).eq("featured", true);
  const rawDate = String(formData.get("date") || "");
  const payload = {
    title,
    subtitle: String(formData.get("subtitle") || "").trim() || null,
    slug,
    description: String(formData.get("description") || "").trim() || null,
    date: rawDate ? new Date(rawDate).toISOString() : null,
    venue: String(formData.get("venue") || "").trim() || null,
    address: String(formData.get("address") || "").trim() || null,
    city: String(formData.get("city") || "").trim() || null,
    image_url: imageUrl,
    info_banner_url: infoBannerUrl,
    hero_media_type: heroMediaType,
    ticket_url: ticketUrl || null,
    showpass_widget_code: showpassWidgetCode || null,
    status,
    featured,
    updated_at: new Date().toISOString(),
  };
  const result = id
    ? await supabase.from("events").update(payload).eq("id", id).select("id").single()
    : await supabase.from("events").insert(payload).select("id").single();
  if (result.error) return { error: result.error.message };
  if (previousBannerUrl && previousBannerUrl !== infoBannerUrl) await removeStoredImage(supabase, "events", previousBannerUrl);
  const eventId = result.data.id;
  const { error: deleteVideosError } = await supabase.from("event_videos").delete().eq("event_id", eventId);
  if (deleteVideosError) return { error: deleteVideosError.message };
  if (videos.length) {
    const { error: videoError } = await supabase.from("event_videos").insert(videos.map((video, index) => ({ ...video!, event_id: eventId, sort_order: index })));
    if (videoError) return { error: videoError.message };
  }
  revalidatePath("/"); revalidatePath("/events"); revalidatePath(`/events/${slug}`); revalidatePath("/admin"); revalidatePath("/admin/events");
  redirect("/admin/events?saved=1");
}

export async function deleteEvent(id: string, imageUrl: string | null, infoBannerUrl: string | null) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) redirect("/admin/events");
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (!error) await Promise.all([
    removeStoredImage(supabase, "events", imageUrl),
    removeStoredImage(supabase, "events", infoBannerUrl),
  ]);
  revalidatePath("/"); revalidatePath("/events"); revalidatePath("/admin/events");
  redirect("/admin/events?deleted=1");
}
