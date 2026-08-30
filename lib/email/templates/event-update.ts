import { Button, EmailLayout, EventCard, escapeHtml } from "../components";
import type { EmailBranding, EventEmailDetails, RenderedEmail } from "../types";

export function renderEventUpdateEmail(input: { branding: EmailBranding; event: EventEmailDetails; title: string; message: string; eventUrl: string }): RenderedEmail {
  const subject = `Important update for ${input.event.name}`;
  const body = `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.13em;color:#a47922">GOOM EVENT PRODUCTION</p><h1 style="margin:0 0 18px;font-size:30px;color:#111318">${escapeHtml(input.title)}</h1><p style="font-size:15px;line-height:1.7">${escapeHtml(input.message).replace(/\n/g, "<br>")}</p>${EventCard(input.event)}${Button("VIEW EVENT", input.eventUrl)}`;
  return { subject, html: EmailLayout({ branding: input.branding, preheader: `Important update for ${input.event.name}.`, children: body }) };
}
