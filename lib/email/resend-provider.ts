import "server-only";
import type { EmailProvider, TicketEmail } from "./email-provider";

function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!); }

export class ResendEmailProvider implements EmailProvider {
  async sendTickets(message: TicketEmail) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.TICKETS_FROM_EMAIL;
    if (!apiKey || !from) throw new Error("Email delivery is not configured");
    const ticketList = message.tickets.map((ticket) => `<li style="margin:14px 0"><strong>${escapeHtml(ticket.ticketNumber)}</strong><br><a href="${ticket.url}">View ticket and QR</a></li>`).join("");
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({
      from, to: [message.customerEmail], subject: `${message.eventName} tickets — ${message.orderNumber}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111"><h1>GOOM Event Production</h1><p>Hello ${escapeHtml(message.customerName)},</p><p>Your tickets for <strong>${escapeHtml(message.eventName)}</strong> are ready.</p><p>${message.eventDate ? escapeHtml(message.eventDate) : ""}${message.venue ? `<br>${escapeHtml(message.venue)}` : ""}</p><p>Order: <strong>${escapeHtml(message.orderNumber)}</strong></p><ul>${ticketList}</ul><p>Present each individual QR at the entrance.</p></div>`,
    }) });
    if (!response.ok) throw new Error("Email provider rejected the message");
    const data = await response.json() as { id?: string };
    return { messageId: data.id || null };
  }
}
