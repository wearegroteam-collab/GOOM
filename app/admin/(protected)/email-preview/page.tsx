import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getEmailBranding } from "@/lib/email/branding";
import { renderComplimentaryEmail, renderRefundConfirmedEmail, renderTicketsReadyEmail } from "@/lib/email/templates";

const event = { name: "Michel Torres", date: "2026-10-30T20:00:00-04:00", venue: "Columbus Club of Niagara Falls", address: "6990 Stanley Avenue", city: "Niagara Falls, Ontario" };

export default function EmailPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const branding = getEmailBranding() || { siteUrl: "http://localhost:3000", logoUrl: "http://localhost:3000/images/goom-logo.png" };
  const tickets = [
    { ticketNumber: "GOOM-MICH-000001", ticketType: "Pre-venta", attendeeName: "Alex Morgan", url: `${branding.siteUrl}/tickets/demo-one` },
    { ticketNumber: "GOOM-MICH-000002", ticketType: "Pre-venta", attendeeName: "Alex Morgan", url: `${branding.siteUrl}/tickets/demo-two` },
  ];
  const previews = [
    ["Tickets ready", renderTicketsReadyEmail({ branding, customerName: "Alex Morgan", orderNumber: "GOOM-ORD-000004", event, tickets, orderUrl: `${branding.siteUrl}/checkout/demo`, downloadAllUrl: `${branding.siteUrl}/api/orders/secure-demo/tickets.pdf`, amounts: { subtotalCents: 8000, feesCents: 0, totalCents: 8000, currency: "CAD", paymentProvider: "mock" } })],
    ["Refund confirmed", renderRefundConfirmedEmail({ branding, customerName: "Alex Morgan", orderNumber: "GOOM-ORD-000004", event, refundAmountCents: 8000, currency: "CAD", ticketNumbers: tickets.map((ticket) => ticket.ticketNumber), orderUrl: `${branding.siteUrl}/checkout/demo` })],
    ["Complimentary", renderComplimentaryEmail({ branding, customerName: "Alex Morgan", event, tickets: [tickets[0]], orderUrl: `${branding.siteUrl}/checkout/demo`, downloadAllUrl: `${branding.siteUrl}/api/orders/secure-demo/tickets.pdf` })],
  ] as const;
  return <><AdminPageHeader eyebrow="Development" title="Email previews" description="Protected development-only previews using representative ticket data." /><div className="email-preview-list">{previews.map(([label, preview])=><section className="admin-record-card" key={label}><h2>{label}</h2><p><strong>Subject:</strong> {preview.subject}</p><iframe title={`${label} email preview`} srcDoc={preview.html} /></section>)}</div></>;
}
