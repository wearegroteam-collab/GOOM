import type { EmailProvider } from "./email-provider";
import type { EmailMessage } from "./types";

type ResendProviderOptions = { apiKey?: string; from?: string; replyTo?: string; fetchImplementation?: typeof fetch };

export class ResendEmailProvider implements EmailProvider {
  private readonly apiKey: string | undefined;
  private readonly from: string | undefined;
  private readonly replyTo: string | undefined;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: ResendProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.RESEND_API_KEY;
    this.from = options.from ?? process.env.TICKETS_FROM_EMAIL;
    this.replyTo = options.replyTo ?? process.env.TICKETS_REPLY_TO_EMAIL;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  async send(message: EmailMessage) {
    if (!this.apiKey || !this.from) throw new Error("Email delivery is not configured");
    const response = await this.fetchImplementation("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": message.idempotencyKey },
      body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, html: message.html, ...(this.replyTo ? { reply_to: this.replyTo } : {}) }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(detail ? `Email provider rejected the message: ${detail.slice(0, 240)}` : "Email provider rejected the message");
    }
    const data = await response.json() as { id?: string };
    return { messageId: data.id || null };
  }
}
