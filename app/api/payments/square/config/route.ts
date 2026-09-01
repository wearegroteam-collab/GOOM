import { NextResponse } from "next/server";
import { getSquareConnection, ticketingProviderName } from "@/lib/payments/connection";
import { squareApplicationMatchesEnvironment, squareTargetEnvironment } from "@/lib/payments/square-oauth";

export async function GET() {
  if (ticketingProviderName() === "mock") return NextResponse.json({ provider: "mock" });
  const connection = await getSquareConnection();
  const applicationId = process.env.SQUARE_APPLICATION_ID;
  const environment = squareTargetEnvironment();
  if (!connection?.connected || !connection.location_reference || !applicationId || connection.environment !== environment || !squareApplicationMatchesEnvironment(applicationId, environment)) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });
  return NextResponse.json({ provider: "square", applicationId, locationId: connection.location_reference, environment });
}
