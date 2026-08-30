import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createTicketPdf, type TicketPdfData } from "../lib/ticketing/ticket-pdf";

const tickets: TicketPdfData[] = ["active", "refunded", "cancelled"].map((status, index) => ({
  eventName: "Michel Torres - Parranda Vallenata",
  eventDate: "2026-10-30T20:00:00-04:00",
  venue: "Columbus Club of Niagara Falls",
  address: "6990 Stanley Avenue",
  city: "Niagara Falls, Ontario, Canada",
  ticketType: index === 0 ? "Pre-venta" : "General Admission",
  ticketNumber: `GOOM-MICH-${String(index + 1).padStart(6, "0")}`,
  attendeeName: "Alex Morgan",
  status: status as TicketPdfData["status"],
  qrUrl: `https://goomeventproduction.vercel.app/tickets/preview-secure-token-${index + 1}`,
}));

const outputDirectory = path.join(process.cwd(), "output", "pdf");
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "goom-ticket-pdf-preview.pdf"), await createTicketPdf(tickets));
