import { SquareClient } from "square";
import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/payments/encryption";
import { squareEnvironment } from "@/lib/payments/connection";
import { squareApplicationMatchesEnvironment, squareTargetEnvironment } from "@/lib/payments/square-oauth";

type OAuthStage = "token_exchange" | "encryption" | "merchant_lookup" | "location_lookup" | "connection_save";

function oauthLog(level: "info"|"warn"|"error", event: string, details: Record<string, unknown> = {}) {
  console[level]("[Square OAuth]", JSON.stringify({ event, ...details }));
}

function failureMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Square OAuth error";
}

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");
  const storedState = request.cookies.get("goom_square_oauth_state")?.value;
  oauthLog("info", "callback_received", { hasCode: Boolean(code), hasState: Boolean(state), hasProviderError: Boolean(providerError), hasStoredState: Boolean(storedState) });

  if (!await getAdminUser()) {
    oauthLog("warn", "admin_session_missing");
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  if (providerError) {
    oauthLog("warn", "authorization_rejected", { providerError });
    return NextResponse.redirect(new URL("/admin/settings/payments?error=square_oauth", request.url));
  }
  if (!state || !storedState || state !== storedState || !code) {
    oauthLog("error", "state_validation_failed", { hasCode: Boolean(code), hasReturnedState: Boolean(state), hasStoredState: Boolean(storedState), stateMatches: Boolean(state && storedState && state === storedState) });
    return NextResponse.redirect(new URL("/admin/settings/payments?error=square_oauth", request.url));
  }
  oauthLog("info", "state_validated");

  const clientId = process.env.SQUARE_APPLICATION_ID;
  const clientSecret = process.env.SQUARE_APPLICATION_SECRET;
  const redirectUri = process.env.SQUARE_OAUTH_REDIRECT_URL;
  const environment = squareTargetEnvironment();
  const admin = createAdminClient();
  if (!clientId || !clientSecret || !redirectUri || !admin || !squareApplicationMatchesEnvironment(clientId, environment)) {
    oauthLog("error", "configuration_invalid", { environment, hasClientId: Boolean(clientId), hasClientSecret: Boolean(clientSecret), hasRedirectUri: Boolean(redirectUri), hasServiceRoleClient: Boolean(admin), applicationMatchesEnvironment: Boolean(clientId && squareApplicationMatchesEnvironment(clientId, environment)) });
    return NextResponse.redirect(new URL("/admin/settings/payments?error=square_oauth", request.url));
  }

  let stage: OAuthStage = "token_exchange";
  try {
    oauthLog("info", "token_exchange_started", { environment, redirectUri });
    const oauth = new SquareClient({ environment: squareEnvironment() });
    const token = await oauth.oAuth.obtainToken({ clientId, clientSecret, code, grantType: "authorization_code", redirectUri });
    if (!token.accessToken) throw new Error("Square token exchange did not return an access token");
    oauthLog("info", "token_exchange_succeeded", { hasAccessToken: true, hasRefreshToken: Boolean(token.refreshToken), hasMerchantId: Boolean(token.merchantId), hasExpiry: Boolean(token.expiresAt) });

    stage = "encryption";
    const encryptedAccessToken = encryptSecret(token.accessToken);
    const encryptedRefreshToken = token.refreshToken ? encryptSecret(token.refreshToken) : null;
    oauthLog("info", "token_encryption_succeeded", { refreshTokenEncrypted: Boolean(encryptedRefreshToken) });

    const seller = new SquareClient({ token: token.accessToken, environment: squareEnvironment() });
    let merchantName: string | null = null;
    stage = "merchant_lookup";
    try {
      const merchantResponse = token.merchantId ? await seller.merchants.get({ merchantId: token.merchantId }) : null;
      merchantName = merchantResponse?.merchant?.businessName || null;
      oauthLog("info", "merchant_lookup_succeeded", { merchantFound: Boolean(merchantResponse?.merchant), merchantNameFound: Boolean(merchantName) });
    } catch (error) {
      oauthLog("warn", "merchant_lookup_failed", { message: failureMessage(error) });
    }

    let location: { id?: string; name?: string|null } | null = null;
    stage = "location_lookup";
    try {
      const locationsResponse = await seller.locations.list();
      const locations = locationsResponse.locations || [];
      location = locations.find((item) => item.status === "ACTIVE" && item.capabilities?.includes("CREDIT_CARD_PROCESSING")) || locations.find((item) => item.status === "ACTIVE") || locations[0] || null;
      oauthLog("info", "location_lookup_succeeded", { locationCount: locations.length, usableLocationFound: Boolean(location?.id) });
    } catch (error) {
      oauthLog("warn", "location_lookup_failed", { message: failureMessage(error) });
    }

    stage = "connection_save";
    const { data: savedConnection, error: saveError } = await admin.from("payment_connections").upsert({
      provider: "square",
      environment,
      account_reference: token.merchantId || null,
      account_name: merchantName,
      location_reference: location?.id || null,
      location_name: location?.name || null,
      access_token_encrypted: encryptedAccessToken,
      refresh_token_encrypted: encryptedRefreshToken,
      token_expires_at: token.expiresAt || null,
      connected: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "provider" }).select("id,connected").single();
    if (saveError || !savedConnection?.connected) throw new Error(saveError?.message || "Square connection was not persisted");
    oauthLog("info", "connection_save_succeeded", { environment, connected: true, hasLocation: Boolean(location?.id) });

    const response = NextResponse.redirect(new URL("/admin/settings/payments?connected=1", request.url));
    response.cookies.delete("goom_square_oauth_state");
    return response;
  } catch (error) {
    oauthLog("error", "oauth_flow_failed", { stage, message: failureMessage(error) });
    return NextResponse.redirect(new URL("/admin/settings/payments?error=square_oauth", request.url));
  }
}
