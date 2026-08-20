import Image from "next/image";
import type { GalleryRecord } from "@/lib/supabase/types";

const images = [
  ["/images/production.jpg", "Live concert production"],
  ["/images/crowd.jpg", "Crowd at a GOOM-style live event"],
  ["/images/dj.jpg", "Festival stage and lights"],
  ["/images/wedding.jpg", "Wedding celebration"],
  ["/images/stage.jpg", "Event production lighting"],
  ["/images/catering.jpg", "Catering presentation"],
];

export function GalleryGrid({ full = false, items }: { full?: boolean; items?: GalleryRecord[] }) {
  const galleryItems = items?.length ? items.map((item) => [item.image_url, item.caption || "GOOM event"] as const) : images;
  return (
    <div className={`gallery-grid ${full ? "gallery-grid-full" : ""}`}>
      {galleryItems.map(([src, alt], index) => (
        <figure key={src} className={`gallery-item gallery-item-${index + 1}`}>
          <Image src={src} alt={alt} fill sizes="(max-width: 767px) 50vw, 33vw" />
          <figcaption><span>0{index + 1}</span>{alt}</figcaption>
        </figure>
      ))}
    </div>
  );
}
