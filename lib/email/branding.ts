import type { EmailBranding } from "./types";

export function getEmailBranding(): EmailBranding | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!siteUrl) return null;
  return {
    siteUrl,
    logoUrl: `${siteUrl}/images/goom-logo.png`,
    instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL || undefined,
    contactEmail: process.env.TICKETS_CONTACT_EMAIL || undefined,
    replyToEmail: process.env.TICKETS_REPLY_TO_EMAIL || undefined,
  };
}
