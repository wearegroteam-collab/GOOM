import { Button, EmailLayout, EventCard, escapeHtml } from "../components";
import type { EmailBranding, EventEmailDetails, RenderedEmail } from "../types";

export function renderEventReminderEmail(input: { branding: EmailBranding; customerName: string; event: EventEmailDetails; ticketsUrl: string }): RenderedEmail {
  const subject = `${input.event.name} is coming up`;
  const body = `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.13em;color:#a47922">GOOM EVENT PRODUCTION</p><h1 style="margin:0 0 18px;font-size:30px;color:#111318">${escapeHtml(input.event.name)} is coming up</h1><p style="font-size:15px;line-height:1.7">Hello ${escapeHtml(input.customerName)},</p><p style="font-size:15px;line-height:1.7">We&apos;re looking forward to seeing you. Have your QR ready at the entrance.</p>${EventCard(input.event)}${Button("VIEW MY TICKETS", input.ticketsUrl)}`;
  return { subject, html: EmailLayout({ branding: input.branding, preheader: `${input.event.name} is coming up.`, children: body }) };
}
