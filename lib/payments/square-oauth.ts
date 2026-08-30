export const SQUARE_SCOPES = ["MERCHANT_PROFILE_READ", "PAYMENTS_READ", "PAYMENTS_WRITE"] as const;

export type SquareTargetEnvironment = "sandbox" | "production";

export const SQUARE_OAUTH_AUTHORIZE_ENDPOINTS: Record<SquareTargetEnvironment, string> = {
  sandbox: "https://connect.squareupsandbox.com/oauth2/authorize",
  production: "https://connect.squareup.com/oauth2/authorize",
};

export function squareTargetEnvironment(value = process.env.SQUARE_ENVIRONMENT): SquareTargetEnvironment {
  return value === "production" ? "production" : "sandbox";
}

export function squareOAuthBase(environment = squareTargetEnvironment()) {
  return new URL(SQUARE_OAUTH_AUTHORIZE_ENDPOINTS[environment]).origin + "/oauth2";
}

export function squareApplicationMatchesEnvironment(applicationId: string, environment = squareTargetEnvironment()) {
  return environment === "sandbox" ? applicationId.startsWith("sandbox-") : !applicationId.startsWith("sandbox-");
}

export function buildSquareAuthorizationUrl(input: { applicationId: string; redirectUri: string; state: string; environment?: SquareTargetEnvironment }) {
  const environment = input.environment || squareTargetEnvironment();
  const url = new URL(SQUARE_OAUTH_AUTHORIZE_ENDPOINTS[environment]);
  url.searchParams.set("client_id", input.applicationId);
  url.searchParams.set("scope", SQUARE_SCOPES.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("redirect_uri", input.redirectUri);
  if (environment === "production") url.searchParams.set("session", "false");
  return url;
}
