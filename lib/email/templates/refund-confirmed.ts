import { Button, EmailLayout, EventCard, escapeHtml } from "../components";
import { formatEmailMoney } from "../format";
import type { EmailBranding, EventEmailDetails, RenderedEmail } from "../types";

export type RefundConfirmedTemplateInput = {
  branding: EmailBranding;
  customerName: string;
  orderNumber: string;
  event: EventEmailDetails;
  refundAmountCents: number;
  currency: string;
  ticketNumbers: string[];
  orderUrl: string;
};

export function renderRefundConfirmedEmail(input: RefundConfirmedTemplateInput): RenderedEmail {
  const subject = `Refund confirmed — ${input.orderNumber}`;
  const tickets = input.ticketNumbers.map((number) => `<li style="margin:5px 0">${escapeHtml(number)}</li>`).join("");
  const body = `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.13em;color:#a47922">GOOM EVENT PRODUCTION</p><h1 style="margin:0 0 18px;font-size:30px;line-height:1.2;color:#111318">Refund confirmed</h1><p style="font-size:15px;line-height:1.7">Hello ${escapeHtml(input.customerName)},</p><p style="font-size:15px;line-height:1.7">Your refund for <strong>${escapeHtml(input.event.name)}</strong> has been processed.</p>${EventCard(input.event, input.orderNumber)}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;background:#f5f2eb"><tr><td style="padding:18px"><p style="margin:0 0 8px;font-size:13px;color:#70737b">Refund amount</p><p style="margin:0;font-size:24px;font-weight:700;color:#111318">${escapeHtml(formatEmailMoney(input.refundAmountCents, input.currency))}</p><p style="margin:18px 0 7px;font-size:13px;font-weight:700">Tickets affected</p><ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.6">${tickets}</ul></td></tr></table><p style="font-size:14px;font-weight:700;line-height:1.6;color:#9a3333">The refunded tickets are no longer valid for entry.</p>${Button("VIEW ORDER", input.orderUrl, true)}`;
  return { subject, html: EmailLayout({ branding: input.branding, preheader: `Your refund for ${input.event.name} was processed.`, children: body }) };
}
