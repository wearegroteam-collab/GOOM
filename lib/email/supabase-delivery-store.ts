import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { DeliveryStore } from "./delivery";

export class SupabaseDeliveryStore implements DeliveryStore {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async create(input: Parameters<DeliveryStore["create"]>[0]) {
    const { data, error } = await this.client.from("email_deliveries").insert({
      order_id: input.orderId,
      refund_id: input.refundId || null,
      template: input.type,
      type: input.type,
      recipient: input.recipient,
      provider: "resend",
      status: "pending",
      idempotency_key: input.idempotencyKey,
      attempt_number: input.attemptNumber,
    }).select("id").single();
    if (error?.code === "23505") return null;
    if (error || !data) throw new Error(error?.message || "Unable to record email delivery");
    return { id: data.id };
  }

  async markSent(id: string, providerMessageId: string | null) {
    const { error } = await this.client.from("email_deliveries").update({ status: "sent", provider_message_id: providerMessageId, sent_at: new Date().toISOString(), error: null, last_error: null }).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async markFailed(id: string, errorMessage: string) {
    const { error } = await this.client.from("email_deliveries").update({ status: "failed", error: errorMessage, last_error: errorMessage }).eq("id", id);
    if (error) throw new Error(error.message);
  }
}
