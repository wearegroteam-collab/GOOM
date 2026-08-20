import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const MAX_IMAGE_SIZE = 6 * 1024 * 1024;

export async function uploadImage(supabase: SupabaseClient<Database>, bucket: "events" | "gallery" | "services", file: File) {
  if (!file.size) return null;
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed.");
  if (file.size > MAX_IMAGE_SIZE) throw new Error("Images must be 6 MB or smaller.");
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function removeStoredImage(supabase: SupabaseClient<Database>, bucket: "events" | "gallery" | "services", url: string | null) {
  if (!url || !url.includes(`/storage/v1/object/public/${bucket}/`)) return;
  const path = decodeURIComponent(url.split(`/storage/v1/object/public/${bucket}/`)[1]?.split("?")[0] || "");
  if (path) await supabase.storage.from(bucket).remove([path]);
}
