export type Service = {
  slug: string;
  title: string;
  description: string;
  image: string;
  icon: "music" | "disc" | "heart" | "utensils" | "sparkles";
};

export const services: Service[] = [
  {
    slug: "concerts-live-events",
    title: "Concerts & Live Events",
    description: "From intimate shows to large-scale live events.",
    image: "/images/concerts.jpg",
    icon: "music",
  },
  {
    slug: "dj-services",
    title: "DJ Services",
    description: "Professional entertainment for weddings, private parties and corporate events.",
    image: "/images/dj.jpg",
    icon: "disc",
  },
  {
    slug: "weddings-private-parties",
    title: "Weddings & Private Parties",
    description: "Music, production and entertainment designed around your celebration.",
    image: "/images/wedding.jpg",
    icon: "heart",
  },
  {
    slug: "catering",
    title: "Catering",
    description: "Food and beverage options for private and corporate events.",
    image: "/images/catering.jpg",
    icon: "utensils",
  },
  {
    slug: "event-production",
    title: "Event Production",
    description: "Sound, lighting, staging and full event coordination.",
    image: "/images/production.jpg",
    icon: "sparkles",
  },
];
