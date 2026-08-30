import "server-only";
import { SquareClient, SquareEnvironment } from "square";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentConnectionRecord } from "@/lib/supabase/types";
import { decryptSecret, encryptSecret } from "./encryption";

export const SQUARE_SCOPES = ["MERCHANT_PROFILE_READ", "PAYMENTS_READ", "PAYMENTS_WRITE"] as const;

export function squareEnvironment() { return process.env.SQUARE_ENVIRONMENT === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox; }
export function squareOAuthBase() { return process.env.SQUARE_ENVIRONMENT === "production" ? "https://connect.squareup.com/oauth2" : "https://connect.squareupsandbox.com/oauth2"; }

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
  if (process.env.PAYMENT_PROVIDER === "mock" && process.env.NODE_ENV !== "production") return "mock" as const;
  return "square" as const;
}
