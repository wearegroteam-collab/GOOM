import Image from "next/image";
import { Disc3, Heart, Music2, Sparkles, UtensilsCrossed } from "lucide-react";
import type { ServiceRecord } from "@/lib/supabase/types";

const iconMap = { music: Music2, disc: Disc3, heart: Heart, utensils: UtensilsCrossed, sparkles: Sparkles };

export function ServiceCard({ service, index }: { service: ServiceRecord; index: number }) {
  const Icon = iconMap[service.icon as keyof typeof iconMap] ?? Sparkles;
  return (
    <article className={`service-card service-card-${index + 1}`}>
      <div className="service-image"><Image src={service.image_url || "/images/production.jpg"} alt={`${service.title} by GOOM`} fill sizes="(max-width: 767px) 100vw, (max-width: 1100px) 50vw, 33vw" /></div>
      <div className="service-content">
        <div className="service-icon"><Icon size={19} strokeWidth={1.6} aria-hidden="true" /></div>
        <p className="card-number">0{index + 1}</p>
        <h3>{service.title}</h3>
        <p>{service.description}</p>
      </div>
    </article>
  );
}
