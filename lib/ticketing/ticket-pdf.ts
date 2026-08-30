import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { TicketStatus } from "@/lib/supabase/types";

export type TicketPdfData = {
  eventName: string;
  eventDate: string | null;
  venue: string | null;
  address: string | null;
  city: string | null;
  ticketType: string;
  ticketNumber: string;
  attendeeName: string | null;
  status: TicketStatus;
  qrUrl: string;
};

const gold = rgb(0.90, 0.72, 0.34);
const ink = rgb(0.06, 0.07, 0.09);
const muted = rgb(0.39, 0.41, 0.45);
const paper = rgb(0.97, 0.96, 0.93);

function fitText(text: string, font: PDFFont, maxSize: number, maxWidth: number) {
  let size = maxSize;
  while (size > 18 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 1;
  return size;
}

function drawLabel(page: PDFPage, label: string, value: string, x: number, y: number, regular: PDFFont, bold: PDFFont, maxWidth = 240) {
  page.drawText(label.toUpperCase(), { x, y, size: 8, font: bold, color: gold });
  const lines = value.match(new RegExp(`.{1,${Math.max(16, Math.floor(maxWidth / 7))}}(?:\\s|$)`, "g"))?.map((line) => line.trim()) || [value];
  lines.slice(0, 2).forEach((line, index) => page.drawText(line, { x, y: y - 18 - index * 15, size: 11, font: regular, color: ink, maxWidth }));
}

function eventDateParts(value: string | null) {
  if (!value) return { date: "Date to be announced", time: "Time to be announced" };
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Toronto" }).format(date),
    time: new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: "America/Toronto" }).format(date),
  };
}

export async function createTicketPdf(tickets: TicketPdfData[]) {
  if (!tickets.length) throw new Error("At least one ticket is required");
  const document = await PDFDocument.create();
  const [regular, bold, logoBytes] = await Promise.all([
    document.embedFont(StandardFonts.Helvetica),
    document.embedFont(StandardFonts.HelveticaBold),
    readFile(path.join(process.cwd(), "public", "images", "goom-logo.png")),
  ]);
  const logo = await document.embedPng(logoBytes);

  for (const ticket of tickets) {
    const page = document.addPage([612, 792]);
    const { width, height } = page.getSize();
    const formatted = eventDateParts(ticket.eventDate);
    const qrBytes = await QRCode.toBuffer(ticket.qrUrl, { width: 900, margin: 2, errorCorrectionLevel: "H", color: { dark: "#05070B", light: "#FFFFFF" } });
    const qr = await document.embedPng(qrBytes);

    page.drawRectangle({ x: 0, y: 0, width, height, color: paper });
    page.drawRectangle({ x: 0, y: height - 180, width, height: 180, color: rgb(0.01, 0.015, 0.025) });
    page.drawRectangle({ x: 0, y: height - 184, width, height: 4, color: gold });
    page.drawImage(logo, { x: 22, y: height - 178, width: 156, height: 156 });
    page.drawText("OFFICIAL ADMISSION TICKET", { x: 190, y: height - 55, size: 9, font: bold, color: gold });
    const eventSize = fitText(ticket.eventName, bold, 30, 382);
    page.drawText(ticket.eventName, { x: 190, y: height - 96, size: eventSize, font: bold, color: rgb(1, 1, 1), maxWidth: 382 });
    page.drawText(ticket.ticketNumber, { x: 190, y: height - 128, size: 12, font: regular, color: rgb(0.72, 0.75, 0.80) });

    if (ticket.status !== "active") {
      const statusColor = ticket.status === "used" ? rgb(0.35, 0.37, 0.41) : rgb(0.68, 0.12, 0.14);
      page.drawRectangle({ x: width - 145, y: height - 171, width: 120, height: 28, color: statusColor });
      page.drawText(ticket.status.toUpperCase(), { x: width - 133, y: height - 162, size: 10, font: bold, color: rgb(1, 1, 1) });
    }

    page.drawRectangle({ x: 32, y: 255, width: 275, height: 320, color: rgb(1, 1, 1), borderColor: rgb(0.85, 0.84, 0.80), borderWidth: 1 });
    page.drawImage(qr, { x: 52, y: 300, width: 235, height: 235 });
    page.drawText("PRESENT THIS QR AT THE ENTRANCE", { x: 69, y: 276, size: 8, font: bold, color: ink });

    drawLabel(page, "Date", formatted.date, 335, 552, regular, bold, 240);
    drawLabel(page, "Time", formatted.time, 335, 493, regular, bold, 240);
    drawLabel(page, "Venue", ticket.venue || "Venue to be announced", 335, 434, regular, bold, 240);
    drawLabel(page, "Address", [ticket.address, ticket.city].filter(Boolean).join(", ") || "Address to be announced", 335, 375, regular, bold, 240);
    drawLabel(page, "Ticket type", ticket.ticketType, 335, 301, regular, bold, 240);
    drawLabel(page, "Attendee", ticket.attendeeName || "Guest", 335, 242, regular, bold, 240);

    page.drawLine({ start: { x: 32, y: 210 }, end: { x: width - 32, y: 210 }, thickness: 1, color: rgb(0.82, 0.81, 0.77), dashArray: [5, 5] });
    page.drawText("GOOM EVENT PRODUCTION", { x: 32, y: 175, size: 10, font: bold, color: ink });
    page.drawText("This ticket contains a unique QR code. Do not share it publicly.", { x: 32, y: 151, size: 9, font: regular, color: muted });
    page.drawText(`Status: ${ticket.status.toUpperCase()}`, { x: 32, y: 126, size: 9, font: bold, color: ticket.status === "active" ? rgb(0.10, 0.43, 0.23) : rgb(0.68, 0.12, 0.14) });
    page.drawText(`Page ${document.getPageCount()} of ${tickets.length}`, { x: width - 104, y: 48, size: 8, font: regular, color: muted });
  }

  document.setTitle(tickets.length === 1 ? tickets[0].ticketNumber : "GOOM Event Tickets");
  document.setAuthor("GOOM Event Production");
  document.setSubject("Official event admission ticket");
  document.setCreator("GOOM Event Production ticketing");
  return document.save();
}
