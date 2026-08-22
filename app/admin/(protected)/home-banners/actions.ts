"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { imageUploadError, isStoredImageUrl, removeStoredImage, type ImageFormState } from "@/lib/admin/storage";
import { createClient } from "@/lib/supabase/server";
import type { HomeBannerRecord } from "@/lib/supabase/types";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function validDestination(value: string) {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

function refreshBanners() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/home-banners");
}

export async function addHomeBanner(_state: ImageFormState, formData: FormData): Promise<ImageFormState> {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase is not configured." };
  const title = text(formData, "title");
  const altText = text(formData, "alt_text") || title;
  const buttonUrl = text(formData, "button_url");
  const desktopUrl = text(formData, "uploaded_desktop_image_url");
  const tabletUrl = text(formData, "uploaded_tablet_image_url") || null;
  const mobileUrl = text(formData, "uploaded_mobile_image_url") || null;
  if (!title) return { success: false, error: "Banner title is required." };
  if (!isStoredImageUrl(desktopUrl, "home-banners")) return { success: false, error: "Desktop image is required." };
  if (tabletUrl && !isStoredImageUrl(tabletUrl, "home-banners")) return { success: false, error: "Uploaded tablet image URL is invalid." };
  if (mobileUrl && !isStoredImageUrl(mobileUrl, "home-banners")) return { success: false, error: "Uploaded mobile image URL is invalid." };
  if (!validDestination(buttonUrl)) return { success: false, error: "Button destination must be a relative path or a valid HTTP/HTTPS URL." };

  const uploaded = [desktopUrl, tabletUrl, mobileUrl].filter((url): url is string => Boolean(url));
  try {
    const { error } = await supabase.from("home_banners").insert({
      title,
      alt_text: altText,
      desktop_image_url: desktopUrl,
      tablet_image_url: tabletUrl,
      mobile_image_url: mobileUrl,
      button_label: text(formData, "button_label") || null,
      button_url: buttonUrl || null,
      active: formData.get("active") === "on",
      sort_order: Number(formData.get("sort_order") || 0),
    });
    if (error) throw error;
  } catch (error) {
    await Promise.all(uploaded.map((url) => removeStoredImage(supabase, "home-banners", url)));
    return { success: false, error: imageUploadError(error, "home banners: create") };
  }
  refreshBanners();
  return { success: true, error: "", url: uploaded[0] };
}

export async function updateHomeBanner(id: string, _state: ImageFormState, formData: FormData): Promise<ImageFormState> {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase is not configured." };
  const { data } = await supabase.from("home_banners").select("*").eq("id", id).maybeSingle();
  if (!data) return { success: false, error: "Banner could not be found." };
  const current = data as HomeBannerRecord;
  const buttonUrl = text(formData, "button_url");
  if (!text(formData, "title")) return { success: false, error: "Banner title is required." };
  if (!validDestination(buttonUrl)) return { success: false, error: "Button destination must be a relative path or a valid HTTP/HTTPS URL." };

  const replacements: Array<{ old: string | null; next: string | null }> = [];
  let desktopUrl = current.desktop_image_url;
  let tabletUrl = formData.get("remove_tablet_image") === "on" ? null : current.tablet_image_url;
  let mobileUrl = formData.get("remove_mobile_image") === "on" ? null : current.mobile_image_url;
  const uploadedDesktopUrl = text(formData, "uploaded_desktop_image_url");
  const uploadedTabletUrl = text(formData, "uploaded_tablet_image_url");
  const uploadedMobileUrl = text(formData, "uploaded_mobile_image_url");
  for (const url of [uploadedDesktopUrl, uploadedTabletUrl, uploadedMobileUrl]) {
    if (url && !isStoredImageUrl(url, "home-banners")) return { success: false, error: "One of the uploaded banner image URLs is invalid." };
  }
  try {
    if (uploadedDesktopUrl) {
      desktopUrl = uploadedDesktopUrl;
      replacements.push({ old: current.desktop_image_url, next: desktopUrl });
    }
    if (uploadedTabletUrl) {
      tabletUrl = uploadedTabletUrl;
      replacements.push({ old: current.tablet_image_url, next: tabletUrl });
    } else if (!tabletUrl && current.tablet_image_url) replacements.push({ old: current.tablet_image_url, next: null });
    if (uploadedMobileUrl) {
      mobileUrl = uploadedMobileUrl;
      replacements.push({ old: current.mobile_image_url, next: mobileUrl });
    } else if (!mobileUrl && current.mobile_image_url) replacements.push({ old: current.mobile_image_url, next: null });

    const { error } = await supabase.from("home_banners").update({
      title: text(formData, "title"),
      alt_text: text(formData, "alt_text") || text(formData, "title"),
      desktop_image_url: desktopUrl,
      tablet_image_url: tabletUrl,
      mobile_image_url: mobileUrl,
      button_label: text(formData, "button_label") || null,
      button_url: buttonUrl || null,
      active: formData.get("active") === "on",
      sort_order: Number(formData.get("sort_order") || 0),
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) throw error;
  } catch (error) {
    await Promise.all(replacements.map(({ old, next }) => next && next !== old ? removeStoredImage(supabase, "home-banners", next) : Promise.resolve()));
    return { success: false, error: imageUploadError(error, "home banners: update") };
  }
  await Promise.all(replacements.map(({ old, next }) => old && old !== next ? removeStoredImage(supabase, "home-banners", old) : Promise.resolve()));
  refreshBanners();
  return { success: true, error: "", url: desktopUrl };
}

export async function deleteHomeBanner(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) return;
  const { data } = await supabase.from("home_banners").select("*").eq("id", id).maybeSingle();
  if (!data) return;
  const banner = data as HomeBannerRecord;
  const { error } = await supabase.from("home_banners").delete().eq("id", id);
  if (!error) await Promise.all([banner.desktop_image_url, banner.tablet_image_url, banner.mobile_image_url].map((url) => removeStoredImage(supabase, "home-banners", url)));
  refreshBanners();
}
