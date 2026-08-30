export type TicketEmail = {
  orderNumber: string; customerName: string; customerEmail: string;
  eventName: string; eventDate: string | null; venue: string | null;
  tickets: Array<{ ticketNumber: string; url: string }>;
};
export interface EmailProvider { sendTickets(message: TicketEmail): Promise<{ messageId: string | null }> }
