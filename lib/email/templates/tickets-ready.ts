import { Button, Divider, EmailLayout, EventCard, OrderSummary, TicketCard, escapeHtml } from "../components";
import { formatEmailMoney } from "../format";
import type { EmailBranding, EventEmailDetails, OrderEmailAmounts, RenderedEmail, TicketEmailItem } from "../types";

export type TicketsReadyTemplateInput = {
  branding: EmailBranding;
  customerName: string;
  orderNumber: string;
  event: EventEmailDetails;
  amounts: OrderEmailAmounts;
  tickets: TicketEmailItem[];
  orderUrl: string;
  downloadAllUrl: string;
};

export function renderTicketsReadyEmail(input: TicketsReadyTemplateInput): RenderedEmail {
  const subject = `Your tickets for ${input.event.name} — ${input.orderNumber}`;
  const ticketCards = input.tickets.map((ticket) => TicketCard(ticket)).join("");
  const body = `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.13em;color:#a47922">GOOM EVENT PRODUCTION</p><h1 style="margin:0 0 18px;font-size:30px;line-height:1.2;color:#111318">Your tickets are ready 🎟️</h1><p style="margin:0 0 10px;font-size:15px;line-height:1.7">Hello ${escapeHtml(input.customerName)},</p><p style="margin:0;font-size:15px;line-height:1.7">Your purchase for <strong>${escapeHtml(input.event.name)}</strong> has been confirmed.</p>${EventCard(input.event, input.orderNumber, formatEmailMoney(input.amounts.totalCents, input.amounts.currency))}${Button("DOWNLOAD ALL TICKETS", input.downloadAllUrl)}<h2 style="margin:28px 0 12px;font-size:20px;color:#111318">Your tickets</h2>${ticketCards}<p style="margin:20px 0;font-size:14px;line-height:1.7;color:#53565e">Present each individual QR at the entrance.</p>${Button("VIEW ALL TICKETS", input.orderUrl, true)}${Divider()}<h2 style="margin:0 0 12px;font-size:18px;color:#111318">Payment confirmed</h2><p style="margin:0 0 4px;font-size:13px;color:#666a72">Order ${escapeHtml(input.orderNumber)}</p>${OrderSummary(input.amounts)}`;
  return { subject, html: EmailLayout({ branding: input.branding, preheader: `Your tickets for ${input.event.name} are ready.`, children: body }) };
}
