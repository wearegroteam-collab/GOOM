import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin/auth";
import { SQUARE_SCOPES, squareOAuthBase } from "@/lib/payments/connection";

export async function GET(request: Request) {
  if (!await getAdminUser()) return NextResponse.redirect(new URL("/admin/login", request.url));
  const applicationId = process.env.SQUARE_APPLICATION_ID;
  const callback = process.env.SQUARE_OAUTH_REDIRECT_URL;
  if (!applicationId || !callback) return NextResponse.redirect(new URL("/admin/settings/payments?error=config", request.url));
  const state = randomBytes(24).toString("base64url");
  const url = new URL(`${squareOAuthBase()}/authorize`);
  url.searchParams.set("client_id", applicationId); url.searchParams.set("scope", SQUARE_SCOPES.join(" ")); url.searchParams.set("state", state); url.searchParams.set("redirect_uri", callback);
  if (process.env.SQUARE_ENVIRONMENT === "production") url.searchParams.set("session", "false");
  const response = NextResponse.redirect(url);
  response.cookies.set("goom_square_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return response;
}
