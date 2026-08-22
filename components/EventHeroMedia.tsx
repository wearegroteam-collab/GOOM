"use client";

import Image from "next/image";
import { Volume2, VolumeX } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { EventVideoRecord } from "@/lib/supabase/types";

function autoplayUrl(video: Pick<EventVideoRecord, "url" | "provider">, muted: boolean) {
  try {
    const url = new URL(video.url);
    if (video.provider === "youtube") {
      const videoId = url.pathname.split("/").filter(Boolean).at(-1);
      url.searchParams.set("autoplay", "1");
      url.searchParams.set("mute", muted ? "1" : "0");
      url.searchParams.set("controls", "1");
      url.searchParams.set("playsinline", "1");
      url.searchParams.set("rel", "0");
      if (videoId) {
        url.searchParams.set("loop", "1");
        url.searchParams.set("playlist", videoId);
      }
    } else if (video.provider === "vimeo") {
      url.searchParams.set("autoplay", "1");
      url.searchParams.set("muted", muted ? "1" : "0");
      url.searchParams.set("loop", "1");
      url.searchParams.set("autopause", "0");
    }
    return url.toString();
  } catch {
    return video.url;
  }
}

export function EventHeroMedia({
  video,
  poster,
  title,
}: {
  video?: EventVideoRecord;
  poster: string;
  title: string;
}) {
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeUrl = useMemo(() => video ? autoplayUrl(video, muted) : "", [video, muted]);

  async function toggleSound() {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
      if (!nextMuted) await videoRef.current.play().catch(() => undefined);
    }
  }

  return <div className="detail-image detail-media">
    {!video && <Image priority src={poster} alt={`${title} live event`} fill sizes="(max-width: 850px) 100vw, 50vw" />}
    {video?.provider === "mp4" && <>
      {/* Promotional event files do not always provide a separate caption track. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} src={video.url} poster={poster} autoPlay muted={muted} loop playsInline preload="metadata" aria-label={`${title} promotional video`} />
    </>}
    {video && video.provider !== "mp4" && <iframe
      key={iframeUrl}
      src={iframeUrl}
      title={`${title} promotional video`}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox={video.provider === "youtube" || video.provider === "vimeo" || video.provider === "instagram" ? "allow-scripts allow-same-origin allow-presentation allow-popups" : "allow-scripts allow-forms allow-presentation allow-popups"}
    />}
    {video && video.provider !== "embed" && video.provider !== "instagram" && <button className="hero-sound-toggle" type="button" onClick={toggleSound} aria-label={muted ? "Activate video sound" : "Mute video"}>
      {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
      <span>{muted ? "Activate sound" : "Mute"}</span>
    </button>}
  </div>;
}
