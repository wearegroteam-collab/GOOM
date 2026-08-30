import { SquareClient } from "square";
import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/payments/encryption";
import { squareEnvironment } from "@/lib/payments/connection";

export async function GET(request: NextRequest) {
  if (!await getAdminUser()) return NextResponse.redirect(new URL("/admin/login", request.url));
  const state = request.nextUrl.searchParams.get("state"); const code = request.nextUrl.searchParams.get("code");
  if (!state || state !== request.cookies.get("goom_square_oauth_state")?.value || !code) return NextResponse.redirect(new URL("/admin/settings/payments?error=oauth", request.url));
  const clientId = process.env.SQUARE_APPLICATION_ID; const clientSecret = process.env.SQUARE_APPLICATION_SECRET; const redirectUri = process.env.SQUARE_OAUTH_REDIRECT_URL;
  const admin = createAdminClient();
  if (!clientId || !clientSecret || !redirectUri || !admin) return NextResponse.redirect(new URL("/admin/settings/payments?error=config", request.url));
  try {
    const oauth = new SquareClient({ environment: squareEnvironment() });
    const token = await oauth.oAuth.obtainToken({ clientId, clientSecret, code, grantType: "authorization_code", redirectUri });
    if (!token.accessToken || !token.refreshToken) throw new Error("Missing OAuth tokens");
    const seller = new SquareClient({ token: token.accessToken, environment: squareEnvironment() });
    const locationsResponse = await seller.locations.list();
    const locations = locationsResponse.locations || [];
    const location = locations.find((item) => item.status === "ACTIVE" && item.capabilities?.includes("CREDIT_CARD_PROCESSING")) || locations.find((item) => item.status === "ACTIVE") || locations[0];
    if (!location?.id) throw new Error("No Square location available");
    await admin.from("payment_connections").upsert({ provider: "square", account_reference: token.merchantId || null, account_name: null, location_reference: location.id, location_name: location.name || null, access_token_encrypted: encryptSecret(token.accessToken), refresh_token_encrypted: encryptSecret(token.refreshToken), token_expires_at: token.expiresAt || null, connected: true }, { onConflict: "provider" });
    const response = NextResponse.redirect(new URL("/admin/settings/payments?connected=1", request.url));
    response.cookies.delete("goom_square_oauth_state"); return response;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[Square OAuth]", error);
    return NextResponse.redirect(new URL("/admin/settings/payments?error=oauth", request.url));
  }
}
