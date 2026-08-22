import type { VideoAspectRatio, VideoProvider } from "@/lib/supabase/types";

export type NormalizedVideo = {
  url: string;
  provider: VideoProvider;
  aspect_ratio: VideoAspectRatio;
};

const ratios: VideoAspectRatio[] = ["auto", "16:9", "9:16", "4:5", "1:1"];

function iframeSource(value: string) {
  return value.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]?.replaceAll("&amp;", "&") || value;
}

export function normalizeVideoInput(value: string, requestedRatio: string = "auto"): NormalizedVideo | null {
  const source = iframeSource(value.trim());
  if (!source || source.length > 2_048) return null;

  let url: URL;
  try { url = new URL(source); } catch { return null; }
  if (url.protocol !== "https:") return null;

  const ratio = ratios.includes(requestedRatio as VideoAspectRatio) ? requestedRatio as VideoAspectRatio : "auto";
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const videoId = host === "youtu.be" ? parts[0] : url.searchParams.get("v") || (parts[0] === "embed" || parts[0] === "shorts" ? parts[1] : null);
    if (!videoId || !/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) return null;
    return { url: `https://www.youtube-nocookie.com/embed/${videoId}`, provider: "youtube", aspect_ratio: ratio === "auto" && parts[0] === "shorts" ? "9:16" : ratio };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const videoId = url.pathname.split("/").filter(Boolean).findLast((part) => /^\d+$/.test(part));
    if (!videoId) return null;
    return { url: `https://player.vimeo.com/video/${videoId}`, provider: "vimeo", aspect_ratio: ratio };
  }

  if (host === "instagram.com" || host === "instagr.am") {
    const parts = url.pathname.split("/").filter(Boolean);
    const kind = parts[0];
    const shortcode = parts[1];
    if (!shortcode || !["p", "reel", "tv"].includes(kind) || !/^[a-zA-Z0-9_-]+$/.test(shortcode)) return null;
    return { url: `https://www.instagram.com/${kind}/${shortcode}/embed/`, provider: "instagram", aspect_ratio: ratio === "auto" ? "4:5" : ratio };
  }

  if (/\.mp4$/i.test(url.pathname)) return { url: url.toString(), provider: "mp4", aspect_ratio: ratio };
  return { url: url.toString(), provider: "embed", aspect_ratio: ratio };
}
