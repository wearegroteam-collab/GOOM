import { NextResponse } from "next/server";
import { getSquareConnection, ticketingProviderName } from "@/lib/payments/connection";

export async function GET() {
  if (ticketingProviderName() === "mock") return NextResponse.json({ provider: "mock" });
  const connection = await getSquareConnection();
  const applicationId = process.env.SQUARE_APPLICATION_ID;
  if (!connection?.connected || !connection.location_reference || !applicationId) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });
  return NextResponse.json({ provider: "square", applicationId, locationId: connection.location_reference, environment: process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox" });
}
