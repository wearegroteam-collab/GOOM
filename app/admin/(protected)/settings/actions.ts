"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

const keys = ["phone", "whatsapp", "email", "instagram", "facebook", "tiktok", "youtube"];

export async function saveSettings(formData: FormData) {
  await requireAdmin(); const supabase = await createClient(); if (!supabase) return;
  const records = keys.map((key) => ({ key, value: String(formData.get(key) || "").trim() }));
  await supabase.from("site_settings").upsert(records, { onConflict: "key" });
  revalidatePath("/"); revalidatePath("/contact"); revalidatePath("/admin/settings");
}
