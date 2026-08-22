export interface HeroSlide {
  id: string;
  title: string;
  desktopImage: string;
  tabletImage: string;
  mobileImage: string;
  alt: string;
  ticketUrl?: string;
  buttonLabel?: string;
  contactUrl?: string;
  active: boolean;
  sortOrder: number;
}

/**
 * Temporary local slider data.
 * Replace the three image paths on each slide with the final banner artwork.
 */
export const heroSlides: HeroSlide[] = [
  {
    id: "michel-torres",
    title: "Michel Torres — Parranda Vallenata",
    desktopImage: "/images/concert-hero.jpg",
    tabletImage: "/images/concert-hero.jpg",
    mobileImage: "/images/concert-hero.jpg",
    alt: "Promotional banner for Michel Torres — Parranda Vallenata",
    ticketUrl: "/events/michel-torres",
    contactUrl: "/contact",
    active: true,
    sortOrder: 1,
  },
  {
    id: "ivan-ovalle",
    title: "Iván Ovalle — Fiesta Blanca",
    desktopImage: "/images/crowd.jpg",
    tabletImage: "/images/crowd.jpg",
    mobileImage: "/images/crowd.jpg",
    alt: "Promotional banner for Iván Ovalle — Fiesta Blanca",
    ticketUrl: "/events/ivan-ovalle",
    contactUrl: "/contact",
    active: true,
    sortOrder: 2,
  },
  {
    id: "coming-soon",
    title: "Upcoming GOOM event",
    desktopImage: "/images/stage.jpg",
    tabletImage: "/images/stage.jpg",
    mobileImage: "/images/stage.jpg",
    alt: "GOOM Event Production stage prepared for an upcoming event",
    ticketUrl: "/events/coming-soon",
    contactUrl: "/contact",
    active: true,
    sortOrder: 3,
  },
];
