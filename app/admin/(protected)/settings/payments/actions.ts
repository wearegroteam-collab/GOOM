"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SquareClient } from "square";
import { decryptSecret } from "@/lib/payments/encryption";
import { getSquareConnection, squareEnvironment } from "@/lib/payments/connection";

export async function disconnectSquare() { await requireAdmin(); const admin = createAdminClient(); const connection = await getSquareConnection(); const clientId = process.env.SQUARE_APPLICATION_ID; const clientSecret = process.env.SQUARE_APPLICATION_SECRET; if (connection?.access_token_encrypted && clientId && clientSecret) { try { const square = new SquareClient({ environment: squareEnvironment() }); await square.oAuth.revokeToken({ clientId, accessToken: decryptSecret(connection.access_token_encrypted) }, { headers: { Authorization: `Client ${clientSecret}` } }); } catch (error) { if (process.env.NODE_ENV !== "production") console.error("[Square disconnect]", error); } } if (admin) await admin.from("payment_connections").update({ connected: false, access_token_encrypted: null, refresh_token_encrypted: null, token_expires_at: null }).eq("provider", "square"); revalidatePath("/admin/settings/payments"); redirect("/admin/settings/payments?disconnected=1"); }
