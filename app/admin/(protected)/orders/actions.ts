"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSquareAccess } from "@/lib/payments/connection";
import { SquareProvider } from "@/lib/payments/square-provider";
import { MockPaymentProvider } from "@/lib/payments/mock-provider";
import { buildRefundIdempotencyKey } from "@/lib/ticketing/core";
import { sendOrderTicketsOnce } from "@/lib/email/send-order-tickets";

export async function createComplimentaryTicket(formData: FormData) {
  await requireAdmin(); const supabase = await createClient(); if (!supabase) return;
  const { data, error } = await supabase.rpc("create_complimentary_tickets", { p_event_id: String(formData.get("event_id")), p_ticket_type_id: String(formData.get("ticket_type_id")), p_quantity: Number(formData.get("quantity")), p_name: String(formData.get("name")), p_email: String(formData.get("email")) });
  if (error || !data) redirect("/admin/orders/complimentary?error=1");
  await sendOrderTicketsOnce(data.order_id); revalidatePath("/admin/orders"); redirect(`/admin/orders/${data.order_id}?created=1`);
}

export async function refundOrder(orderId: string) {
  await requireAdmin(); const admin = createAdminClient(); if (!admin) return;
  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).single();
  if (!order || order.status !== "paid" || !order.provider_payment_id || order.total_cents <= 0) redirect(`/admin/orders/${orderId}?error=refund`);
  const idempotencyKey = buildRefundIdempotencyKey(order.id); const access = order.payment_provider === "square" ? await getSquareAccess() : null;
  const provider = order.payment_provider === "square" && access ? new SquareProvider(access.accessToken, access.locationId) : process.env.NODE_ENV !== "production" && order.payment_provider === "mock" ? new MockPaymentProvider() : null;
  if (!provider) redirect(`/admin/orders/${orderId}?error=refund`);
  const { data: refund } = await admin.from("refunds").insert({ order_id: order.id, amount_cents: order.total_cents, currency: order.currency, idempotency_key: idempotencyKey, created_by: (await requireAdmin()).id }).select("id").single();
  if (!refund) redirect(`/admin/orders/${orderId}?error=refund`);
  try { const result = await provider.refundPayment({ paymentId: order.provider_payment_id, amountCents: order.total_cents, currency: order.currency, idempotencyKey, reason: `GOOM refund ${order.order_number}` }); await admin.from("refunds").update({ provider_refund_id: result.providerRefundId, status: result.status === "completed" && order.payment_provider !== "mock" ? "pending" : result.status }).eq("id", refund.id); if (order.payment_provider === "mock" && result.status === "completed") await admin.rpc("finalize_ticket_refund", { p_provider_refund_id: result.providerRefundId }); } catch { await admin.from("refunds").update({ status: "failed" }).eq("id", refund.id); redirect(`/admin/orders/${orderId}?error=refund`); }
  revalidatePath(`/admin/orders/${orderId}`); redirect(`/admin/orders/${orderId}?refund=1`);
}
