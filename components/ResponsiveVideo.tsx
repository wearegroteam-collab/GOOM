import type { EventVideoRecord } from "@/lib/supabase/types";

const ratioClass = {
  auto: "video-ratio-auto",
  "16:9": "video-ratio-wide",
  "9:16": "video-ratio-vertical",
  "4:5": "video-ratio-portrait",
  "1:1": "video-ratio-square",
} as const;

export function ResponsiveVideo({ video, title, compact = false }: { video: Pick<EventVideoRecord, "url" | "provider" | "aspect_ratio">; title: string; compact?: boolean }) {
  const ratio = video.aspect_ratio === "auto" && video.provider !== "mp4" ? "16:9" : video.aspect_ratio;
  const className = `event-video ${ratioClass[ratio]} ${compact ? "event-video-compact" : ""}`;

  if (video.provider === "mp4") {
    return <div className={className}>
      {/* External promotional files do not always provide a separate caption track. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video src={video.url} controls playsInline preload="none" aria-label={title} />
    </div>;
  }

  const knownProvider = video.provider === "youtube" || video.provider === "vimeo";
  return <div className={className}><iframe src={video.url} title={title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox={knownProvider ? "allow-scripts allow-same-origin allow-presentation allow-popups" : "allow-scripts allow-forms allow-presentation allow-popups"} /></div>;
}
