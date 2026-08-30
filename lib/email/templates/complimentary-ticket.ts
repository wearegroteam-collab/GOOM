import { Button, EmailLayout, EventCard, TicketCard, escapeHtml } from "../components";
import type { EmailBranding, EventEmailDetails, RenderedEmail, TicketEmailItem } from "../types";

export type ComplimentaryTemplateInput = {
  branding: EmailBranding;
  customerName: string;
  event: EventEmailDetails;
  tickets: TicketEmailItem[];
  orderUrl: string;
  downloadAllUrl: string;
};

export function renderComplimentaryEmail(input: ComplimentaryTemplateInput): RenderedEmail {
  const subject = `Your complimentary ticket for ${input.event.name}`;
  const body = `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.13em;color:#a47922">GOOM EVENT PRODUCTION</p><h1 style="margin:0 0 18px;font-size:30px;line-height:1.2;color:#111318">You&apos;ve received a complimentary ticket.</h1><p style="font-size:15px;line-height:1.7">Hello ${escapeHtml(input.customerName)},</p><p style="font-size:15px;line-height:1.7">You&apos;re invited to <strong>${escapeHtml(input.event.name)}</strong>. Your individual ticket${input.tickets.length === 1 ? " is" : "s are"} below.</p>${EventCard(input.event)}${Button("DOWNLOAD ALL TICKETS", input.downloadAllUrl)}${input.tickets.map((ticket) => TicketCard(ticket, true)).join("")}<p style="font-size:14px;line-height:1.7;color:#555961">Have each QR ready at the entrance.</p>${input.tickets.length > 1 ? Button("VIEW ALL TICKETS", input.orderUrl, true) : ""}`;
  return { subject, html: EmailLayout({ branding: input.branding, preheader: `Your invitation to ${input.event.name}.`, children: body }) };
}
