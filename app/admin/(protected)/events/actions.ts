"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { removeStoredImage, uploadImage } from "@/lib/admin/storage";
import { createClient } from "@/lib/supabase/server";
import type { EventStatus } from "@/lib/supabase/types";

export type EventActionState = { error: string };

export async function saveEvent(id: string | null, _state: EventActionState, formData: FormData): Promise<EventActionState> {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured." };
  const title = String(formData.get("title") || "").trim();
  const slug = String(formData.get("slug") || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!title || !slug) return { error: "Event name and slug are required." };
  const status = String(formData.get("status") || "draft") as EventStatus;
  if (!["draft", "published", "past"].includes(status)) return { error: "Invalid event status." };

  let imageUrl = String(formData.get("current_image_url") || "") || null;
  const image = formData.get("image");
  try {
    if (image instanceof File && image.size) imageUrl = await uploadImage(supabase, "events", image);
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
    ticket_url: String(formData.get("ticket_url") || "").trim() || null,
    status,
    featured,
    updated_at: new Date().toISOString(),
  };
  const result = id ? await supabase.from("events").update(payload).eq("id", id) : await supabase.from("events").insert(payload);
  if (result.error) return { error: result.error.message };
  revalidatePath("/"); revalidatePath("/events"); revalidatePath("/admin"); revalidatePath("/admin/events");
  redirect("/admin/events?saved=1");
}

export async function deleteEvent(id: string, imageUrl: string | null) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) redirect("/admin/events");
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (!error) await removeStoredImage(supabase, "events", imageUrl);
  revalidatePath("/"); revalidatePath("/events"); revalidatePath("/admin/events");
  redirect("/admin/events?deleted=1");
}
