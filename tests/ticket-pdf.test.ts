import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { createTicketPdf, type TicketPdfData } from "../lib/ticketing/ticket-pdf";

const baseTicket: TicketPdfData = {
  eventName: "Michel Torres - Parranda Vallenata",
  eventDate: "2026-10-30T20:00:00-04:00",
  venue: "Columbus Club of Niagara Falls",
  address: "6990 Stanley Avenue",
  city: "Niagara Falls, Ontario, Canada",
  ticketType: "Pre-venta",
  ticketNumber: "GOOM-MICH-000001",
  attendeeName: "Alex Morgan",
  status: "active",
  qrUrl: "https://goom.example/tickets/secure-verification-token",
};

test("individual ticket PDF is a valid one-page document", async () => {
  const bytes = await createTicketPdf([baseTicket]);
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), "%PDF-");
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(), 1);
  assert.equal(document.getTitle(), baseTicket.ticketNumber);
  assert.doesNotMatch(Buffer.from(bytes).toString("latin1"), /secure-verification-token/);
});

test("order PDF creates one page per ticket and supports invalid statuses", async () => {
  const tickets: TicketPdfData[] = [
    baseTicket,
    { ...baseTicket, ticketNumber: "GOOM-MICH-000002", status: "refunded" },
    { ...baseTicket, ticketNumber: "GOOM-MICH-000003", status: "cancelled" },
  ];
  const document = await PDFDocument.load(await createTicketPdf(tickets));
  assert.equal(document.getPageCount(), 3);
  assert.equal(document.getTitle(), "GOOM Event Tickets");
});
