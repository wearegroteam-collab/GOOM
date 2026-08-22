import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { IMAGE_EXTENSIONS, MAX_IMAGE_SIZE, validateImage } from "@/lib/image-rules";
import { getSupabaseConfig } from "@/lib/supabase/config";

export { MAX_IMAGE_SIZE };

export type ImageFormState = { success: boolean; error: string; url?: string };

class ImageValidationError extends Error {}

type ImageBucket = "events" | "gallery" | "services" | "home-banners";

export async function uploadImage(supabase: SupabaseClient<Database>, bucket: ImageBucket, file: File) {
  if (!file.size) return null;
  const validationError = validateImage(file);
  if (validationError) throw new ImageValidationError(validationError);
  const extension = IMAGE_EXTENSIONS[file.type];
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export function isStoredImageUrl(url: string, bucket: ImageBucket) {
  try {
    const parsed = new URL(url);
    const config = getSupabaseConfig();
    if (!config) return false;
    return parsed.origin === new URL(config.url).origin && parsed.pathname.includes(`/storage/v1/object/public/${bucket}/`);
  } catch { return false; }
}

export function imageUploadError(error: unknown, context: string) {
  if (process.env.NODE_ENV !== "production") console.error(`[GOOM image upload: ${context}]`, error);
  return error instanceof ImageValidationError ? error.message : "Unable to upload image. Please try again.";
}

export async function removeStoredImage(supabase: SupabaseClient<Database>, bucket: ImageBucket, url: string | null) {
  if (!url || !url.includes(`/storage/v1/object/public/${bucket}/`)) return;
  const path = decodeURIComponent(url.split(`/storage/v1/object/public/${bucket}/`)[1]?.split("?")[0] || "");
  if (path) await supabase.storage.from(bucket).remove([path]);
}
