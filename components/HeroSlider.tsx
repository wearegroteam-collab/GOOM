"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getImageProps } from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, MessageCircle } from "lucide-react";
import type { HeroSlide } from "@/data/heroSlides";

const AUTOPLAY_DELAY = 6000;

function ResponsiveBanner({ slide, eager }: { slide: HeroSlide; eager: boolean }) {
  const common = { alt: slide.alt, sizes: "100vw", quality: 75 } as const;
  const { props: { srcSet: desktop } } = getImageProps({
    ...common,
    src: slide.desktopImage,
    width: 1920,
    height: 700,
  });
  const { props: { srcSet: tablet } } = getImageProps({
    ...common,
    src: slide.tabletImage,
    width: 1200,
    height: 900,
  });
  const { props: { srcSet: mobile, ...imageProps } } = getImageProps({
    ...common,
    src: slide.mobileImage,
    width: 1080,
    height: 1350,
    loading: eager ? "eager" : "lazy",
    fetchPriority: eager ? "high" : "auto",
  });

  return (
    <picture>
      <source media="(min-width: 1025px)" srcSet={desktop} />
      <source media="(min-width: 768px)" srcSet={tablet} />
      <source media="(max-width: 767px)" srcSet={mobile} />
      <img {...imageProps} alt={slide.alt} draggable={false} />
    </picture>
  );
}

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const availableSlides = useMemo(
    () => slides.filter((slide) => slide.active).sort((a, b) => a.sortOrder - b.sortOrder),
    [slides],
  );
  const [current, setCurrent] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const touchStart = useRef<number | null>(null);
  const hasMultiple = availableSlides.length > 1;

  const move = useCallback((direction: number, manual = false) => {
    if (!availableSlides.length) return;
    setCurrent((value) => (value + direction + availableSlides.length) % availableSlides.length);
    if (manual) setUserPaused(true);
  }, [availableSlides.length]);

  const goTo = (index: number) => {
    setCurrent(index);
    setUserPaused(true);
  };

  useEffect(() => {
    if (!hasMultiple || hovered || userPaused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => move(1), AUTOPLAY_DELAY);
    return () => window.clearInterval(timer);
  }, [hasMultiple, hovered, move, userPaused]);

  if (!availableSlides.length) return null;
  const activeSlide = availableSlides[current];

  return (
    <section
      className="hero-slider"
      aria-roledescription="carousel"
      aria-label="Featured GOOM events"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0]?.clientX ?? null;
        setUserPaused(true);
      }}
      onTouchEnd={(event) => {
        if (touchStart.current === null) return;
        const distance = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
        if (Math.abs(distance) > 45) move(distance < 0 ? 1 : -1, true);
        touchStart.current = null;
      }}
    >
      <h1 className="visually-hidden">GOOM Event Production</h1>
      <div className="hero-slider-stage" aria-live={userPaused ? "polite" : "off"}>
        {availableSlides.map((slide, index) => (
          <div
            key={slide.id}
            className={`hero-slide ${index === current ? "is-active" : ""}`}
            aria-hidden={index !== current}
          >
            <ResponsiveBanner slide={slide} eager={index === 0} />
            <span className="visually-hidden">{slide.title}</span>
          </div>
        ))}
      </div>

      <div className="hero-slider-bar">
        {hasMultiple && (
          <div className="slider-navigation">
            <div className="slider-arrows">
              <button type="button" onClick={() => move(-1, true)} aria-label="Previous banner"><ArrowLeft aria-hidden="true" /></button>
              <button type="button" onClick={() => move(1, true)} aria-label="Next banner"><ArrowRight aria-hidden="true" /></button>
            </div>
            <div className="slider-dots" aria-label="Choose a banner">
              {availableSlides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  className={index === current ? "is-active" : ""}
                  onClick={() => goTo(index)}
                  aria-label={`Show banner ${index + 1}: ${slide.title}`}
                  aria-current={index === current ? "true" : undefined}
                />
              ))}
            </div>
          </div>
        )}

        <div className="hero-slider-actions">
          {activeSlide.ticketUrl && (
            <Link className="button slider-ticket-button" href={activeSlide.ticketUrl}>
              Buy tickets <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          )}
          <Link className="slider-contact-button" href={activeSlide.contactUrl || "/contact"}>
            Contact / Plan your event <MessageCircle size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
