"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { imageUploadError, isStoredImageUrl, removeStoredImage, type ImageFormState } from "@/lib/admin/storage";
import { createClient } from "@/lib/supabase/server";

export async function addGalleryImage(_state: ImageFormState, formData: FormData): Promise<ImageFormState> {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase is not configured." };
  const imageUrl = String(formData.get("uploaded_image_url") || "");
  if (!isStoredImageUrl(imageUrl, "gallery")) return { success: false, error: "Upload an image before saving." };
  try {
    const { error } = await supabase.from("gallery").insert({ image_url: imageUrl, caption: String(formData.get("caption") || "").trim() || null, active: true, featured: formData.get("featured") === "on", sort_order: Number(formData.get("sort_order") || 0) });
    if (error) throw error;
  } catch (error) {
    await removeStoredImage(supabase, "gallery", imageUrl);
    return { success: false, error: imageUploadError(error, "gallery") };
  }
  revalidatePath("/"); revalidatePath("/gallery"); revalidatePath("/admin/gallery");
  return { success: true, error: "", url: imageUrl };
}

export async function updateGalleryImage(id: string, formData: FormData) {
  await requireAdmin(); const supabase = await createClient(); if (!supabase) return;
  await supabase.from("gallery").update({ caption: String(formData.get("caption") || "").trim() || null, active: formData.get("active") === "on", featured: formData.get("featured") === "on", sort_order: Number(formData.get("sort_order") || 0) }).eq("id", id);
  revalidatePath("/"); revalidatePath("/gallery"); revalidatePath("/admin/gallery");
}

export async function deleteGalleryImage(id: string, imageUrl: string) {
  await requireAdmin(); const supabase = await createClient(); if (!supabase) return;
  const { error } = await supabase.from("gallery").delete().eq("id", id);
  if (!error) await removeStoredImage(supabase, "gallery", imageUrl);
  revalidatePath("/"); revalidatePath("/gallery"); revalidatePath("/admin/gallery");
}
