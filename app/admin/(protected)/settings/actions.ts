"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { parseServiceFeeValue, type ServiceFeeType } from "@/lib/ticketing/service-fee";

const keys = ["phone", "whatsapp", "email", "instagram", "facebook", "tiktok", "youtube"];

export async function saveSettings(formData: FormData) {
  await requireAdmin(); const supabase = await createClient(); if (!supabase) return;
  const records = keys.map((key) => ({ key, value: String(formData.get(key) || "").trim() }));
  await supabase.from("site_settings").upsert(records, { onConflict: "key" });
  revalidatePath("/"); revalidatePath("/contact"); revalidatePath("/admin/settings");
}

export async function saveServiceFeeSettings(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) redirect("/admin/settings?fee_error=configuration");

  const enabled = formData.get("service_fee_enabled") === "on";
  const type = String(formData.get("service_fee_type") || "fixed") as ServiceFeeType;
  if (!(["fixed", "percentage"] as string[]).includes(type)) redirect("/admin/settings?fee_error=invalid");
  const value = parseServiceFeeValue(type, String(formData.get("service_fee_amount") || "0"));
  if (value === null) redirect("/admin/settings?fee_error=invalid");

  const { error } = await supabase.from("site_settings").upsert([
    { key: "service_fee_enabled", value: String(enabled) },
    { key: "service_fee_type", value: type },
    { key: "service_fee_value", value: String(value) },
  ], { onConflict: "key" });
  if (error) redirect("/admin/settings?fee_error=save");
  revalidatePath("/admin/settings");
  revalidatePath("/events/[slug]", "page");
  redirect("/admin/settings?fee_saved=1");
}
