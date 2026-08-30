import type { EmailBranding, EventEmailDetails, OrderEmailAmounts, TicketEmailItem } from "../types";
import { formatEmailMoney, formatEventDateTime, humanizePaymentProvider } from "../format";

export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

export function Button(label: string, url: string, secondary = false) {
  const background = secondary ? "#17191f" : "#e6b956";
  const color = secondary ? "#ffffff" : "#111318";
  return `<table class="email-button" role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0"><tr><td bgcolor="${background}" style="border-radius:6px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 22px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:.06em;color:${color};text-decoration:none">${escapeHtml(label)}</a></td></tr></table>`;
}

export function Divider() {
  return '<div style="height:1px;background:#e7e3da;margin:26px 0;line-height:1px">&nbsp;</div>';
}

export function EmailHeader(branding: EmailBranding) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:28px 30px;background:#08090c;text-align:center"><img src="${escapeHtml(branding.logoUrl)}" width="190" alt="GOOM Event Production" style="display:block;width:190px;max-width:70%;height:auto;margin:0 auto;border:0"></td></tr></table>`;
}

export function EmailFooter(branding: EmailBranding) {
  const links = [`<a href="${escapeHtml(branding.siteUrl)}" style="color:#e6b956;text-decoration:none">Website</a>`, branding.instagramUrl ? `<a href="${escapeHtml(branding.instagramUrl)}" style="color:#e6b956;text-decoration:none">Instagram</a>` : "", branding.contactEmail ? `<a href="mailto:${escapeHtml(branding.contactEmail)}" style="color:#e6b956;text-decoration:none">Contact</a>` : ""].filter(Boolean).join(" &nbsp;&nbsp;·&nbsp;&nbsp; ");
  const replyLine = branding.replyToEmail ? "Questions? You can reply directly to this email." : "Please do not reply to this automated message.";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:28px 30px;background:#111318;text-align:center;font-family:Arial,Helvetica,sans-serif;color:#a7a9af"><p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#ffffff">GOOM Event Production</p><p style="margin:0 0 16px;font-size:12px">${links}</p><p style="margin:0;font-size:11px;line-height:1.6">This email was sent because you purchased or received a ticket from GOOM Event Production.<br>${replyLine}</p></td></tr></table>`;
}

export function EmailLayout(input: { branding: EmailBranding; preheader: string; children: string }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.preheader)}</title><style>@media only screen and (max-width:620px){.email-shell{width:100%!important}.email-body{padding:26px 20px!important}.email-button,.email-button tbody,.email-button tr,.email-button td{width:100%!important}.email-button a{display:block!important;text-align:center!important}.email-card{padding:18px!important}}</style></head><body style="margin:0;padding:0;background:#eceae5"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(input.preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eceae5"><tr><td align="center" style="padding:24px 10px"><table role="presentation" width="600" class="email-shell" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-collapse:collapse"><tr><td>${EmailHeader(input.branding)}</td></tr><tr><td class="email-body" style="padding:38px 34px;font-family:Arial,Helvetica,sans-serif;color:#181a20">${input.children}</td></tr><tr><td>${EmailFooter(input.branding)}</td></tr></table></td></tr></table></body></html>`;
}

export function EventCard(event: EventEmailDetails, orderNumber?: string, total?: string) {
  const formatted = formatEventDateTime(event.date, event.timeZone);
  const location = [event.venue, event.address, event.city].filter(Boolean).map((value) => escapeHtml(value!)).join("<br>");
  const optionalRows = [orderNumber ? ["Order", orderNumber] : null, total ? ["Total paid", total] : null].filter(Boolean) as string[][];
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;background:#f5f2eb;border:1px solid #e1ddd2;border-radius:8px"><tr><td class="email-card" style="padding:22px"><p style="margin:0 0 16px;font-size:19px;font-weight:700;color:#111318">${escapeHtml(event.name)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6"><tr><td width="110" valign="top" style="padding:3px 8px 3px 0;color:#767980">Date</td><td style="padding:3px 0;color:#111318">${escapeHtml(formatted.date)}<br>${escapeHtml(formatted.time)}</td></tr><tr><td width="110" valign="top" style="padding:3px 8px 3px 0;color:#767980">Venue</td><td style="padding:3px 0;color:#111318">${location || "To be announced"}</td></tr>${optionalRows.map(([label, value]) => `<tr><td width="110" valign="top" style="padding:3px 8px 3px 0;color:#767980">${escapeHtml(label)}</td><td style="padding:3px 0;color:#111318">${escapeHtml(value)}</td></tr>`).join("")}</table></td></tr></table>`;
}

export function TicketCard(ticket: TicketEmailItem, invitation = false) {
  const attendee = ticket.attendeeName ? `<p style="margin:5px 0 0;font-size:13px;color:#6b6e76">Guest: ${escapeHtml(ticket.attendeeName)}</p>` : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:14px 0;border:1px solid #ddd9cf;border-radius:8px"><tr><td class="email-card" style="padding:20px"><p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.12em;color:#a47922">${invitation ? "COMPLIMENTARY TICKET" : escapeHtml(ticket.ticketType.toUpperCase())}</p><p style="margin:0;font-size:18px;font-weight:700;color:#111318">${escapeHtml(ticket.ticketNumber)}</p>${attendee}${Button("VIEW TICKET & QR", ticket.url)}</td></tr></table>`;
}

export function OrderSummary(amounts: OrderEmailAmounts) {
  const rows = [["Subtotal", formatEmailMoney(amounts.subtotalCents, amounts.currency)], ["Fees", formatEmailMoney(amounts.feesCents, amounts.currency)], ["Total", formatEmailMoney(amounts.totalCents, amounts.currency)], ["Payment", humanizePaymentProvider(amounts.paymentProvider)]];
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px">${rows.map(([label, value], index) => `<tr><td style="padding:7px 0;color:#72757d;${index === 2 ? "border-top:1px solid #dedad0;font-weight:700" : ""}">${escapeHtml(label)}</td><td align="right" style="padding:7px 0;color:#111318;${index === 2 ? "border-top:1px solid #dedad0;font-weight:700" : ""}">${escapeHtml(value)}</td></tr>`).join("")}</table>`;
}
