"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export async function saveTicketType(eventId: string, id: string | null, formData: FormData) {
  await requireAdmin(); const supabase = await createClient(); if (!supabase) return;
  const price = Number(formData.get("price")); const total = Number(formData.get("quantity_total"));
  if (!Number.isFinite(price) || price < 0 || !Number.isInteger(total) || total < 0) redirect(`/admin/events/${eventId}/tickets?error=values`);
  const payload = { event_id: eventId, name: String(formData.get("name") || "").trim(), description: String(formData.get("description") || "").trim() || null, price_cents: Math.round(price * 100), currency: String(formData.get("currency") || "CAD").toUpperCase(), quantity_total: total, sales_start: formData.get("sales_start") ? new Date(String(formData.get("sales_start"))).toISOString() : null, sales_end: formData.get("sales_end") ? new Date(String(formData.get("sales_end"))).toISOString() : null, active: formData.get("active") === "on", sort_order: Number(formData.get("sort_order")) || 0 };
  if (!payload.name) redirect(`/admin/events/${eventId}/tickets?error=name`);
  if (id) await supabase.from("ticket_types").update(payload).eq("id", id).eq("event_id", eventId); else await supabase.from("ticket_types").insert(payload);
  revalidatePath(`/admin/events/${eventId}/tickets`); revalidatePath("/events"); redirect(`/admin/events/${eventId}/tickets?saved=1`);
}

export async function deleteTicketType(eventId: string, id: string) {
  await requireAdmin(); const supabase = await createClient(); if (!supabase) return;
  const { count } = await supabase.from("order_items").select("id", { count: "exact", head: true }).eq("ticket_type_id", id);
  if ((count || 0) > 0) redirect(`/admin/events/${eventId}/tickets?error=sales`);
  await supabase.from("ticket_types").delete().eq("id", id).eq("event_id", eventId);
  revalidatePath(`/admin/events/${eventId}/tickets`); redirect(`/admin/events/${eventId}/tickets?deleted=1`);
}

export async function updateEventSales(eventId: string, formData: FormData) {
  await requireAdmin(); const supabase = await createClient(); if (!supabase) return;
  const capacity = String(formData.get("capacity") || "").trim();
  await supabase.from("events").update({ sales_enabled: formData.get("sales_enabled") === "on", capacity: capacity ? Number(capacity) : null }).eq("id", eventId);
  revalidatePath(`/admin/events/${eventId}/tickets`); revalidatePath("/events"); redirect(`/admin/events/${eventId}/tickets?saved=1`);
}
