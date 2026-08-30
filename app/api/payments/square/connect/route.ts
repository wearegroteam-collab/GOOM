import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin/auth";
import { assertPaymentEncryptionConfigured } from "@/lib/payments/encryption";
import { buildSquareAuthorizationUrl, squareApplicationMatchesEnvironment, squareTargetEnvironment } from "@/lib/payments/square-oauth";

export async function GET(request: Request) {
  if (!await getAdminUser()) return NextResponse.redirect(new URL("/admin/login", request.url));
  const applicationId = process.env.SQUARE_APPLICATION_ID;
  const callback = process.env.SQUARE_OAUTH_REDIRECT_URL;
  if (!applicationId || !callback) return NextResponse.redirect(new URL("/admin/settings/payments?error=config", request.url));
  const environment = squareTargetEnvironment();
  if (!squareApplicationMatchesEnvironment(applicationId, environment)) return NextResponse.redirect(new URL("/admin/settings/payments?error=config", request.url));
  try {
    assertPaymentEncryptionConfigured();
  } catch (error) {
    console.error("[Square OAuth]", JSON.stringify({ event: "encryption_configuration_invalid", message: error instanceof Error ? error.message : "Invalid encryption configuration" }));
    return NextResponse.redirect(new URL("/admin/settings/payments?error=config", request.url));
  }
  const state = randomBytes(24).toString("base64url");
  const url = buildSquareAuthorizationUrl({ applicationId, redirectUri: callback, state, environment });
  console.info("[Square OAuth]", JSON.stringify({ event: "authorization_started", environment, redirectUri: callback, scopes: url.searchParams.get("scope") }));
  const response = NextResponse.redirect(url);
  response.cookies.set("goom_square_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return response;
}
