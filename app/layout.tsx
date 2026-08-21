import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://goomevents.ca");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "GOOM Event Production | Niagara", template: "%s | GOOM" },
  description: "Unforgettable experiences through music, production and entertainment across Niagara.",
  openGraph: { title: "GOOM Event Production", description: "Music. Production. Unforgettable moments.", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: "GOOM Event Production", description: "Music. Production. Unforgettable moments.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Header />{children}<Footer /></body></html>;
}
