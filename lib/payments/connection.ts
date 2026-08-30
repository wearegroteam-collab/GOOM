import "server-only";
import { SquareClient, SquareEnvironment } from "square";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentConnectionRecord } from "@/lib/supabase/types";
import { decryptSecret, encryptSecret } from "./encryption";
import { SQUARE_SCOPES, squareTargetEnvironment } from "./square-oauth";

export { SQUARE_SCOPES, squareOAuthBase } from "./square-oauth";

export function squareEnvironment() { return squareTargetEnvironment() === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox; }

export async function getSquareConnection() {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("payment_connections").select("*").eq("provider", "square").maybeSingle();
  return data as PaymentConnectionRecord | null;
}

export async function getSquareAccess() {
  const admin = createAdminClient();
  const connection = await getSquareConnection();
  if (!admin || !connection?.connected || !connection.access_token_encrypted || !connection.location_reference) return null;
  let accessToken = decryptSecret(connection.access_token_encrypted);
  const refreshToken = connection.refresh_token_encrypted ? decryptSecret(connection.refresh_token_encrypted) : null;
  const expiresSoon = connection.token_expires_at && new Date(connection.token_expires_at).getTime() < Date.now() + 5 * 24 * 60 * 60 * 1000;
  if (expiresSoon && refreshToken) {
    const clientId = process.env.SQUARE_APPLICATION_ID;
    const clientSecret = process.env.SQUARE_APPLICATION_SECRET;
    if (!clientId || !clientSecret) throw new Error("Square OAuth credentials are not configured");
    const oauth = new SquareClient({ environment: squareEnvironment() });
    const refreshed = await oauth.oAuth.obtainToken({ clientId, clientSecret, grantType: "refresh_token", refreshToken, scopes: [...SQUARE_SCOPES] });
    if (!refreshed.accessToken) throw new Error("Square did not return a refreshed access token");
    accessToken = refreshed.accessToken;
    await admin.from("payment_connections").update({
      access_token_encrypted: encryptSecret(accessToken),
      refresh_token_encrypted: encryptSecret(refreshed.refreshToken || refreshToken),
      token_expires_at: refreshed.expiresAt || null,
      connected: true,
    }).eq("id", connection.id);
  }
  return { accessToken, locationId: connection.location_reference, connection };
}

export function ticketingProviderName() {
  if (process.env.PAYMENT_PROVIDER === "mock") return "mock" as const;
  return "square" as const;
}
