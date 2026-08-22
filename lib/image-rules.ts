export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
export const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export function validateImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return "Unsupported image format.";
  if (file.size > MAX_IMAGE_SIZE) return "Image is too large. Maximum size is 10 MB.";
  return "";
}
