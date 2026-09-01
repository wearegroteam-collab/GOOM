import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ticketingProviderName } from "@/lib/payments/connection";
import { validateCart } from "@/lib/ticketing/core";
import { normalizeCustomerEmail, normalizeCustomerPhone } from "@/lib/ticketing/customer";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { eventId?: string; name?: string; email?: string; phone?: string; items?: Array<{ ticketTypeId: string; quantity: number }> };
    const phone = normalizeCustomerPhone(body.phone || "");
    const email = normalizeCustomerEmail(body.email || "");
    if (!body.eventId || !body.name?.trim() || !/^\S+@\S+\.\S+$/.test(email) || !phone || !Array.isArray(body.items)) return NextResponse.json({ error: "Please enter your full name, email and a valid phone number." }, { status: 400 });
    const items = validateCart(body.items);
    const provider = ticketingProviderName();
    if (provider === "square") {
      const admin = createAdminClient();
      const { data: connection } = admin ? await admin.from("payment_connections").select("connected").eq("provider", "square").maybeSingle() : { data: null };
      if (!connection?.connected) return NextResponse.json({ error: "Online sales are temporarily unavailable." }, { status: 503 });
    }
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Ticketing is not configured." }, { status: 503 });
    const { data, error } = await supabase.rpc("create_ticket_order", {
      p_event_id: body.eventId, p_customer_name: body.name.trim(), p_customer_email: email,
      p_customer_phone: phone, p_payment_provider: provider,
      p_items: items.map((item) => ({ ticket_type_id: item.ticketTypeId, quantity: item.quantity })),
    });
    if (error) {
      const inventory = error.message.includes("INSUFFICIENT_INVENTORY");
      const buyer = error.message.includes("INVALID_PHONE") || error.message.includes("INVALID_BUYER");
      return NextResponse.json({ error: inventory ? "Some tickets just sold out. Please update your selection." : buyer ? "Please enter valid buyer details, including phone number." : "We could not reserve those tickets. Please try again." }, { status: inventory ? 409 : 400 });
    }
    return NextResponse.json({ order: data });
  } catch {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }
}
