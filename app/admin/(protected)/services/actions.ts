"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { imageUploadError, isStoredImageUrl, removeStoredImage, type ImageFormState } from "@/lib/admin/storage";
import { createClient } from "@/lib/supabase/server";

export async function saveService(id: string | null, _state: ImageFormState, formData: FormData): Promise<ImageFormState> {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase is not configured." };
  const title = String(formData.get("title") || "").trim();
  if (!title) return { success: false, error: "Service title is required." };
  const previousImageUrl = String(formData.get("current_image_url") || "") || null;
  let imageUrl = previousImageUrl;
  const uploadedImageUrl = String(formData.get("uploaded_image_url") || "");
  if (uploadedImageUrl && !isStoredImageUrl(uploadedImageUrl, "services")) return { success: false, error: "Uploaded image URL is invalid." };
  try {
    if (uploadedImageUrl) imageUrl = uploadedImageUrl;
    const payload = { title, description: String(formData.get("description") || "").trim() || null, image_url: imageUrl, icon: String(formData.get("icon") || "sparkles"), active: formData.get("active") === "on", sort_order: Number(formData.get("sort_order") || 0) };
    const { error } = id ? await supabase.from("services").update(payload).eq("id", id) : await supabase.from("services").insert(payload);
    if (error) throw error;
  } catch (error) {
    if (imageUrl && imageUrl !== previousImageUrl) await removeStoredImage(supabase, "services", imageUrl);
    return { success: false, error: imageUploadError(error, "services") };
  }
  if (previousImageUrl && previousImageUrl !== imageUrl) await removeStoredImage(supabase, "services", previousImageUrl);
  revalidatePath("/"); revalidatePath("/services"); revalidatePath("/admin/services");
  return { success: true, error: "", url: imageUrl || undefined };
}

export async function deleteService(id: string, imageUrl: string | null) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) return;
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (!error) await removeStoredImage(supabase, "services", imageUrl);
  revalidatePath("/"); revalidatePath("/services"); revalidatePath("/admin/services");
}
