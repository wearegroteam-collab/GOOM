"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { removeStoredImage, uploadImage } from "@/lib/admin/storage";
import { createClient } from "@/lib/supabase/server";

export async function saveService(id: string | null, formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) return;
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  let imageUrl = String(formData.get("current_image_url") || "") || null;
  const image = formData.get("image");
  if (image instanceof File && image.size) imageUrl = await uploadImage(supabase, "services", image);
  const payload = { title, description: String(formData.get("description") || "").trim() || null, image_url: imageUrl, icon: String(formData.get("icon") || "sparkles"), active: formData.get("active") === "on", sort_order: Number(formData.get("sort_order") || 0) };
  if (id) await supabase.from("services").update(payload).eq("id", id); else await supabase.from("services").insert(payload);
  revalidatePath("/"); revalidatePath("/services"); revalidatePath("/admin/services");
}

export async function deleteService(id: string, imageUrl: string | null) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) return;
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (!error) await removeStoredImage(supabase, "services", imageUrl);
  revalidatePath("/"); revalidatePath("/services"); revalidatePath("/admin/services");
}
