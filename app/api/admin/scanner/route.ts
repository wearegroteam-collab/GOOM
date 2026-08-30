import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeTicketValue } from "@/lib/ticketing/core";

export async function POST(request: Request) {
  if (!await getAdminUser()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { value?: string; checkIn?: boolean }; const value = normalizeTicketValue(body.value || "");
  if (!value) return NextResponse.json({ result: "invalid" }, { status: 400 });
  const supabase = await createClient(); if (!supabase) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  const { data, error } = await supabase.rpc("scan_ticket", { p_value: value, p_check_in: Boolean(body.checkIn) });
  if (error) return NextResponse.json({ error: "Ticket could not be checked." }, { status: 400 });
  return NextResponse.json(data);
}
