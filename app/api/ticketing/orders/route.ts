import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ticketingProviderName } from "@/lib/payments/connection";
import { validateCart } from "@/lib/ticketing/core";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { eventId?: string; name?: string; email?: string; phone?: string; items?: Array<{ ticketTypeId: string; quantity: number }> };
    if (!body.eventId || !body.name || !body.email || !Array.isArray(body.items)) return NextResponse.json({ error: "Complete the required checkout fields." }, { status: 400 });
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
      p_event_id: body.eventId, p_customer_name: body.name, p_customer_email: body.email,
      p_customer_phone: body.phone || "", p_payment_provider: provider,
      p_items: items.map((item) => ({ ticket_type_id: item.ticketTypeId, quantity: item.quantity })),
    });
    if (error) {
      const inventory = error.message.includes("INSUFFICIENT_INVENTORY");
      return NextResponse.json({ error: inventory ? "Some tickets just sold out. Please update your selection." : "We could not reserve those tickets. Please try again." }, { status: inventory ? 409 : 400 });
    }
    return NextResponse.json({ order: data });
  } catch {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }
}
