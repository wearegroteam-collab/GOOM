"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { removeStoredImage, uploadImage } from "@/lib/admin/storage";
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

export async function addHomeBanner(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) return;
  const title = text(formData, "title");
  const altText = text(formData, "alt_text") || title;
  const buttonUrl = text(formData, "button_url");
  const desktop = formData.get("desktop_image");
  const tablet = formData.get("tablet_image");
  const mobile = formData.get("mobile_image");
  if (!title || !(desktop instanceof File) || !desktop.size || !validDestination(buttonUrl)) return;

  const uploaded: string[] = [];
  try {
    const desktopUrl = await uploadImage(supabase, "home-banners", desktop);
    if (!desktopUrl) return;
    uploaded.push(desktopUrl);
    const tabletUrl = tablet instanceof File && tablet.size ? await uploadImage(supabase, "home-banners", tablet) : null;
    if (tabletUrl) uploaded.push(tabletUrl);
    const mobileUrl = mobile instanceof File && mobile.size ? await uploadImage(supabase, "home-banners", mobile) : null;
    if (mobileUrl) uploaded.push(mobileUrl);
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
  } catch {
    await Promise.all(uploaded.map((url) => removeStoredImage(supabase, "home-banners", url)));
    return;
  }
  refreshBanners();
}

export async function updateHomeBanner(id: string, formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) return;
  const { data } = await supabase.from("home_banners").select("*").eq("id", id).maybeSingle();
  if (!data) return;
  const current = data as HomeBannerRecord;
  const buttonUrl = text(formData, "button_url");
  if (!text(formData, "title") || !validDestination(buttonUrl)) return;

  const replacements: Array<{ old: string | null; next: string | null }> = [];
  let desktopUrl = current.desktop_image_url;
  let tabletUrl = formData.get("remove_tablet_image") === "on" ? null : current.tablet_image_url;
  let mobileUrl = formData.get("remove_mobile_image") === "on" ? null : current.mobile_image_url;
  try {
    const desktop = formData.get("desktop_image");
    const tablet = formData.get("tablet_image");
    const mobile = formData.get("mobile_image");
    if (desktop instanceof File && desktop.size) {
      desktopUrl = await uploadImage(supabase, "home-banners", desktop) || desktopUrl;
      replacements.push({ old: current.desktop_image_url, next: desktopUrl });
    }
    if (tablet instanceof File && tablet.size) {
      tabletUrl = await uploadImage(supabase, "home-banners", tablet);
      replacements.push({ old: current.tablet_image_url, next: tabletUrl });
    } else if (!tabletUrl && current.tablet_image_url) replacements.push({ old: current.tablet_image_url, next: null });
    if (mobile instanceof File && mobile.size) {
      mobileUrl = await uploadImage(supabase, "home-banners", mobile);
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
  } catch {
    await Promise.all(replacements.map(({ old, next }) => next && next !== old ? removeStoredImage(supabase, "home-banners", next) : Promise.resolve()));
    return;
  }
  await Promise.all(replacements.map(({ old, next }) => old && old !== next ? removeStoredImage(supabase, "home-banners", old) : Promise.resolve()));
  refreshBanners();
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
