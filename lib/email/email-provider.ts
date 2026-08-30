import type { EmailMessage } from "./types";

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ messageId: string | null }>;
}
