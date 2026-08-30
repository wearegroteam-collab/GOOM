import { WebhooksHelper } from "square";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderTicketsOnce } from "@/lib/email/send-order-tickets";

type SquareWebhook = { event_id?: string; type?: string; data?: { object?: { payment?: { id?: string; status?: string; reference_id?: string; order_id?: string; amount_money?: { amount?: number | string; currency?: string } }; refund?: { id?: string; status?: string; payment_id?: string; amount_money?: { amount?: number | string; currency?: string } } } } };

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") || "";
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const notificationUrl = process.env.SQUARE_WEBHOOK_URL;
  if (!signatureKey || !notificationUrl || !await WebhooksHelper.verifySignature({ requestBody: body, signatureHeader: signature, signatureKey, notificationUrl })) return new Response("Invalid signature", { status: 403 });
  const admin = createAdminClient();
  if (!admin) return new Response("Server not configured", { status: 503 });
  let payload: SquareWebhook;
  try { payload = JSON.parse(body) as SquareWebhook; } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (!payload.event_id || !payload.type) return new Response("Invalid event", { status: 400 });
  const { error: eventError } = await admin.from("payment_webhook_events").insert({ provider: "square", provider_event_id: payload.event_id, event_type: payload.type, payload });
  if (eventError?.code === "23505") {
    const { data: existing } = await admin.from("payment_webhook_events").select("processed_at").eq("provider", "square").eq("provider_event_id", payload.event_id).maybeSingle();
    if (existing?.processed_at) return new Response("Already processed", { status: 200 });
  }
  if (eventError) return new Response("Unable to record event", { status: 500 });
  try {
    const payment = payload.data?.object?.payment;
    if ((payload.type === "payment.created" || payload.type === "payment.updated") && payment?.reference_id && payment.id) {
      const { data: order } = await admin.from("orders").select("*").eq("id", payment.reference_id).eq("payment_provider", "square").maybeSingle();
      if (order) {
        const amountMatches = Number(payment.amount_money?.amount) === order.total_cents && payment.amount_money?.currency === order.currency;
        if (!amountMatches) throw new Error("Payment amount does not match order");
        if (payment.status === "COMPLETED") {
          await admin.rpc("finalize_paid_ticket_order", { p_order_id: order.id, p_provider_payment_id: payment.id, p_provider_order_id: payment.order_id || null });
          await sendOrderTicketsOnce(order.id);
        } else if (payment.status === "FAILED" || payment.status === "CANCELED") await admin.rpc("fail_ticket_order", { p_order_id: order.id });
      }
    }
    const refund = payload.data?.object?.refund;
    if ((payload.type === "refund.created" || payload.type === "refund.updated") && refund?.id) {
      const { data: refundRow } = await admin.from("refunds").select("*").eq("provider_refund_id", refund.id).maybeSingle();
      if (refundRow && refundRow.status !== "completed" && refund.status === "COMPLETED") {
        await admin.rpc("finalize_ticket_refund", { p_provider_refund_id: refund.id });
      } else if (refundRow && (refund.status === "FAILED" || refund.status === "REJECTED")) await admin.from("refunds").update({ status: "failed" }).eq("id", refundRow.id);
    }
    await admin.from("payment_webhook_events").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("provider", "square").eq("provider_event_id", payload.event_id);
    return new Response("OK", { status: 200 });
  } catch (error) {
    await admin.from("payment_webhook_events").update({ processing_error: error instanceof Error ? error.message : "Processing failed" }).eq("provider", "square").eq("provider_event_id", payload.event_id);
    return new Response("Processing failed", { status: 500 });
  }
}
