"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { removeStoredImage, uploadImage } from "@/lib/admin/storage";
import { createClient } from "@/lib/supabase/server";

export async function addGalleryImage(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) return;
  const image = formData.get("image");
  if (!(image instanceof File) || !image.size) return;
  const imageUrl = await uploadImage(supabase, "gallery", image);
  if (!imageUrl) return;
  await supabase.from("gallery").insert({ image_url: imageUrl, caption: String(formData.get("caption") || "").trim() || null, active: true, featured: formData.get("featured") === "on", sort_order: Number(formData.get("sort_order") || 0) });
  revalidatePath("/"); revalidatePath("/gallery"); revalidatePath("/admin/gallery");
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
