import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { EventRecord, EventVideoRecord, GalleryRecord, ServiceRecord } from "@/lib/supabase/types";

const now = new Date().toISOString();

export const fallbackEvents: EventRecord[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Michel Torres",
    subtitle: "Parranda Vallenata",
    slug: "michel-torres",
    description: "Halloween night with live music, special guests and prizes for the best costumes.",
    date: "2026-10-30T20:00:00-04:00",
    venue: "Columbus Club of Niagara Falls",
    address: "6990 Stanley Avenue",
    city: "Niagara Falls, Ontario, Canada",
    image_url: "/images/concert-hero.jpg",
    ticket_url: null,
    showpass_widget_code: null,
    status: "published",
    featured: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    title: "Iván Ovalle",
    subtitle: "Fiesta Blanca",
    slug: "ivan-ovalle",
    description: "A memorable white party in Niagara Falls.",
    date: "2026-05-08T20:00:00-04:00",
    venue: "Niagara Falls",
    address: null,
    city: "Niagara Falls",
    image_url: "/images/crowd.jpg",
    ticket_url: null,
    showpass_widget_code: null,
    status: "past",
    featured: false,
    created_at: now,
    updated_at: now,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    title: "Upcoming Event",
    subtitle: "Coming Soon",
    slug: "coming-soon",
    description: "A new GOOM experience is on the way.",
    date: null,
    venue: null,
    address: null,
    city: "Niagara Region",
    image_url: "/images/stage.jpg",
    ticket_url: null,
    showpass_widget_code: null,
    status: "published",
    featured: false,
    created_at: now,
    updated_at: now,
  },
];

export const fallbackServices: ServiceRecord[] = [
  ["Concerts & Live Events", "From intimate shows to large-scale live events.", "/images/concerts.jpg", "music"],
  ["DJ Services", "Professional entertainment for weddings, private parties and corporate events.", "/images/dj.jpg", "disc"],
  ["Weddings & Private Parties", "Music, production and entertainment designed around your celebration.", "/images/wedding.jpg", "heart"],
  ["Catering", "Food and beverage options for private and corporate events.", "/images/catering.jpg", "utensils"],
  ["Event Production", "Sound, lighting, staging and full event coordination.", "/images/production.jpg", "sparkles"],
].map(([title, description, image_url, icon], index) => ({
  id: `10000000-0000-4000-8000-00000000000${index + 1}`,
  title,
  description,
  image_url,
  icon,
  active: true,
  sort_order: index + 1,
}));

export const fallbackGallery: GalleryRecord[] = [
  ["/images/production.jpg", "Live concert production"],
  ["/images/crowd.jpg", "Crowd at a GOOM live event"],
  ["/images/dj.jpg", "Festival stage and lights"],
  ["/images/wedding.jpg", "Wedding celebration"],
  ["/images/stage.jpg", "Event production lighting"],
  ["/images/catering.jpg", "Catering presentation"],
].map(([image_url, caption], index) => ({
  id: `20000000-0000-4000-8000-00000000000${index + 1}`,
  image_url,
  caption,
  active: true,
  featured: index < 6,
  sort_order: index + 1,
  created_at: now,
}));

export type SiteSettings = Record<"phone" | "whatsapp" | "email" | "instagram" | "facebook" | "tiktok" | "youtube", string>;

export const fallbackSettings: SiteSettings = {
  phone: "+1 000 000 0000",
  whatsapp: "10000000000",
  email: "hello@goomevents.ca",
  instagram: "#",
  facebook: "#",
  tiktok: "#",
  youtube: "#",
};

export async function getPublishedEvents() {
  try {
    const supabase = await createClient();
    if (!supabase) return fallbackEvents;
    const { data, error } = await supabase.from("events").select("*").in("status", ["published", "past"]).order("date", { ascending: false, nullsFirst: false });
    if (error || !data?.length) return fallbackEvents;
    return data as EventRecord[];
  } catch { return fallbackEvents; }
}

export async function getFeaturedEvent() {
  try {
    const supabase = await createClient();
    if (!supabase) return fallbackEvents[0];
    const { data, error } = await supabase.from("events").select("*").eq("status", "published").eq("featured", true).maybeSingle();
    if (error || !data) return fallbackEvents[0];
    return data as EventRecord;
  } catch { return fallbackEvents[0]; }
}

export async function getPublishedEventBySlug(slug: string) {
  try {
    const supabase = await createClient();
    if (supabase) {
      const { data } = await supabase.from("events").select("*").eq("slug", slug).in("status", ["published", "past"]).maybeSingle();
      if (data) return data as EventRecord;
    }
  } catch { /* fallback below */ }
  return fallbackEvents.find((event) => event.slug === slug) ?? null;
}

export async function getEventVideos(eventId: string): Promise<EventVideoRecord[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("event_videos")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order");
    if (error) return [];
    return (data || []) as EventVideoRecord[];
  } catch { return []; }
}

export async function getActiveServices() {
  try {
    const supabase = await createClient();
    if (!supabase) return fallbackServices;
    const { data, error } = await supabase.from("services").select("*").eq("active", true).order("sort_order");
    if (error || !data?.length) return fallbackServices;
    return data as ServiceRecord[];
  } catch { return fallbackServices; }
}

export async function getGalleryItems(featuredOnly = false) {
  try {
    const supabase = await createClient();
    if (!supabase) return fallbackGallery;
    let query = supabase.from("gallery").select("*").eq("active", true).order("sort_order");
    if (featuredOnly) query = query.eq("featured", true);
    const { data, error } = await query;
    if (error || !data?.length) return fallbackGallery;
    return data as GalleryRecord[];
  } catch { return fallbackGallery; }
}

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const supabase = await createClient();
    if (!supabase) return fallbackSettings;
    const { data, error } = await supabase.from("site_settings").select("key,value");
    if (error || !data?.length) return fallbackSettings;
    return { ...fallbackSettings, ...Object.fromEntries(data.map((item) => [item.key, item.value ?? ""])) } as SiteSettings;
  } catch { return fallbackSettings; }
}
