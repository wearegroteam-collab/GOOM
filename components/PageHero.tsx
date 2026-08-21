import Image from "next/image";

export function PageHero({ eyebrow, title, text, image, imageAlt }: { eyebrow: string; title: string; text: string; image: string; imageAlt: string }) {
  return (
    <section className="page-hero">
      <div className="page-hero-media"><Image src={image} alt={imageAlt} fill sizes="(max-width: 767px) 100vw, 56vw" /></div>
      <div className="page-hero-content">
        <p className="section-eyebrow"><span />{eyebrow}</p>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </section>
  );
}
