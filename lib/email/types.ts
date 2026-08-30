export type EmailType =
  | "tickets_ready"
  | "refund_confirmed"
  | "complimentary"
  | "event_reminder"
  | "event_update";

export type EmailMessage = { to: string; subject: string; html: string; idempotencyKey: string };
export type RenderedEmail = Pick<EmailMessage, "subject" | "html">;
export type EmailBranding = { siteUrl: string; logoUrl: string; instagramUrl?: string; contactEmail?: string; replyToEmail?: string };
export type EventEmailDetails = { name: string; date: string | null; venue: string | null; address: string | null; city: string | null; timeZone?: string };
export type TicketEmailItem = { ticketNumber: string; ticketType: string; attendeeName: string | null; url: string };
export type OrderEmailAmounts = { subtotalCents: number; feesCents: number; totalCents: number; currency: string; paymentProvider: string };
