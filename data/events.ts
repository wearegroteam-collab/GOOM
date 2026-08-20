export type EventStatus = "available" | "past" | "soon";

export type Event = {
  slug: string;
  artist: string;
  title: string;
  date: string;
  location: string;
  status: EventStatus;
  image: string;
};

export const events: Event[] = [
  {
    slug: "michel-torres",
    artist: "Michel Torres",
    title: "Parranda Vallenata",
    date: "October 30",
    location: "Niagara Falls",
    status: "available",
    image: "/images/concert-hero.jpg",
  },
  {
    slug: "ivan-ovalle",
    artist: "Iván Ovalle",
    title: "Fiesta Blanca",
    date: "May 8",
    location: "Niagara Falls",
    status: "past",
    image: "/images/crowd.jpg",
  },
  {
    slug: "coming-soon",
    artist: "Upcoming Event",
    title: "Coming Soon",
    date: "To be announced",
    location: "Niagara Region",
    status: "soon",
    image: "/images/stage.jpg",
  },
];
