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
import { resendOrderTickets, sendOrderTicketsOnce } from "@/lib/email/send-order-tickets";
import { resendRefundConfirmation, sendRefundConfirmationOnce } from "@/lib/email/send-refund-confirmation";

export async function createComplimentaryTicket(formData: FormData) {
  await requireAdmin(); const supabase = await createClient(); if (!supabase) return;
  const { data, error } = await supabase.rpc("create_complimentary_tickets", { p_event_id: String(formData.get("event_id")), p_ticket_type_id: String(formData.get("ticket_type_id")), p_quantity: Number(formData.get("quantity")), p_name: String(formData.get("name")), p_email: String(formData.get("email")) });
  if (error || !data) redirect("/admin/orders/complimentary?error=1");
  await sendOrderTicketsOnce(data.order_id); revalidatePath("/admin/orders"); redirect(`/admin/orders/${data.order_id}?created=1`);
}

export async function approveEtransferOrder(orderId: string) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) redirect(`/admin/orders/${orderId}?etransfer=error`);
  const { error } = await supabase.rpc("approve_etransfer_order", { p_order_id: orderId });
  if (error) redirect(`/admin/orders/${orderId}?etransfer=error`);
  const delivery = await sendOrderTicketsOnce(orderId);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${orderId}?etransfer=approved&email=${delivery.status === "sent" ? "sent" : "failed"}`);
}

async function completeRefund(orderId: string, refundId: string, providerRefundId: string) {
  const admin = createAdminClient();
  if (!admin) return false;
  const { error } = await admin.rpc("finalize_ticket_refund", { p_provider_refund_id: providerRefundId });
  if (error) return false;
  await sendRefundConfirmationOnce(refundId);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/events");
  return true;
}

export async function refundOrder(orderId: string) {
  const adminUser = await requireAdmin(); const admin = createAdminClient(); if (!admin) return;
  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).single();
  if (order?.status === "refunded") redirect(`/admin/orders/${orderId}?already_refunded=1`);
  if (!order || order.status !== "paid" || !order.provider_payment_id || order.total_cents <= 0) redirect(`/admin/orders/${orderId}?error=refund`);
  const idempotencyKey = buildRefundIdempotencyKey(order.id); const access = order.payment_provider === "square" ? await getSquareAccess() : null;
  const provider = order.payment_provider === "square" && access ? new SquareProvider(access.accessToken, access.locationId) : order.payment_provider === "mock" && process.env.PAYMENT_PROVIDER === "mock" ? new MockPaymentProvider() : null;
  if (!provider) redirect(`/admin/orders/${orderId}?error=refund`);
  const { data: activeRefund } = await admin.from("refunds").select("*").eq("order_id", order.id).in("status", ["pending", "completed"]).maybeSingle();
  if (activeRefund?.status === "completed") redirect(`/admin/orders/${orderId}?already_refunded=1`);
  if (activeRefund?.status === "pending" && activeRefund.provider_refund_id) {
    let current;
    try { current = await provider.getRefundStatus(activeRefund.provider_refund_id); }
    catch { redirect(`/admin/orders/${orderId}?refund=pending`); }
    if (current.status === "completed") {
      if (!await completeRefund(orderId, activeRefund.id, current.providerRefundId)) redirect(`/admin/orders/${orderId}?error=refund_sync`);
      redirect(`/admin/orders/${orderId}?refund=completed`);
    }
    if (current.status === "failed") {
      await admin.from("refunds").update({ status: "failed" }).eq("id", activeRefund.id);
      redirect(`/admin/orders/${orderId}?error=refund`);
    }
    redirect(`/admin/orders/${orderId}?refund=pending`);
  }
  let refund = activeRefund;
  if (!refund) {
    const { data: existingKey } = await admin.from("refunds").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
    refund = existingKey;
  }
  if (!refund) {
    const { data } = await admin.from("refunds").insert({ order_id: order.id, amount_cents: order.total_cents, currency: order.currency, idempotency_key: idempotencyKey, created_by: adminUser.id }).select("*").single();
    refund = data;
  } else if (refund.status === "failed") {
    const { data } = await admin.from("refunds").update({ status: "pending" }).eq("id", refund.id).select("*").single();
    refund = data;
  }
  if (!refund) redirect(`/admin/orders/${orderId}?error=refund`);
  let result;
  try {
    result = await provider.refundPayment({ paymentId: order.provider_payment_id, amountCents: order.total_cents, currency: order.currency, idempotencyKey, reason: `GOOM refund ${order.order_number}` });
  } catch {
    await admin.from("refunds").update({ status: "failed" }).eq("id", refund.id);
    redirect(`/admin/orders/${orderId}?error=refund`);
  }
  if (result.status === "failed") {
    await admin.from("refunds").update({ provider_refund_id: result.providerRefundId, status: "failed" }).eq("id", refund.id);
    redirect(`/admin/orders/${orderId}?error=refund`);
  }
  await admin.from("refunds").update({ provider_refund_id: result.providerRefundId, status: "pending" }).eq("id", refund.id);
  if (result.status === "completed") {
    if (!await completeRefund(orderId, refund.id, result.providerRefundId)) redirect(`/admin/orders/${orderId}?error=refund_sync`);
    redirect(`/admin/orders/${orderId}?refund=completed`);
  }
  revalidatePath(`/admin/orders/${orderId}`); redirect(`/admin/orders/${orderId}?refund=submitted`);
}

export async function reconcileRefundOrder(orderId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  if (!admin) redirect(`/admin/orders/${orderId}?error=refund_sync`);
  const [{ data: order }, { data: refund }] = await Promise.all([
    admin.from("orders").select("payment_provider").eq("id", orderId).maybeSingle(),
    admin.from("refunds").select("*").eq("order_id", orderId).eq("status", "pending").maybeSingle(),
  ]);
  if (!order || order.payment_provider !== "square" || !refund?.provider_refund_id) redirect(`/admin/orders/${orderId}?error=refund_sync`);
  const access = await getSquareAccess();
  if (!access) redirect(`/admin/orders/${orderId}?error=refund_sync`);
  let result;
  try { result = await new SquareProvider(access.accessToken, access.locationId).getRefundStatus(refund.provider_refund_id); }
  catch { redirect(`/admin/orders/${orderId}?error=refund_sync`); }
  if (result.status === "failed") {
    await admin.from("refunds").update({ status: "failed" }).eq("id", refund.id);
    redirect(`/admin/orders/${orderId}?error=refund`);
  }
  if (result.status === "pending") redirect(`/admin/orders/${orderId}?refund=pending`);
  if (!await completeRefund(orderId, refund.id, result.providerRefundId)) redirect(`/admin/orders/${orderId}?error=refund_sync`);
  redirect(`/admin/orders/${orderId}?refund=completed`);
}

export async function resendTransactionalEmail(orderId: string, type: "tickets" | "refund", refundId?: string) {
  await requireAdmin();
  if (type === "refund") {
    const admin = createAdminClient();
    if (!admin || !refundId) redirect(`/admin/orders/${orderId}?email=failed`);
    const { data: refund } = await admin.from("refunds").select("order_id").eq("id", refundId).maybeSingle();
    if (!refund || refund.order_id !== orderId) redirect(`/admin/orders/${orderId}?email=failed`);
  }
  const result = type === "refund" && refundId
    ? await resendRefundConfirmation(refundId)
    : await resendOrderTickets(orderId);
  revalidatePath(`/admin/orders/${orderId}`);
  redirect(`/admin/orders/${orderId}?email=${result.status === "sent" ? "sent" : "failed"}`);
}
