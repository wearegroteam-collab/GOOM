import assert from "node:assert/strict";
import test from "node:test";
import { SQUARE_OAUTH_AUTHORIZE_ENDPOINTS, SQUARE_SCOPES, buildSquareAuthorizationUrl, squareApplicationMatchesEnvironment, squareOAuthBase, squareTargetEnvironment } from "../lib/payments/square-oauth";

const redirectUri = "https://goomeventproduction.vercel.app/api/payments/square/callback";

test("Square OAuth uses distinct official Sandbox and Production endpoints", () => {
  assert.equal(SQUARE_OAUTH_AUTHORIZE_ENDPOINTS.sandbox, "https://connect.squareupsandbox.com/oauth2/authorize");
  assert.equal(SQUARE_OAUTH_AUTHORIZE_ENDPOINTS.production, "https://connect.squareup.com/oauth2/authorize");
  assert.equal(squareOAuthBase("sandbox"), "https://connect.squareupsandbox.com/oauth2");
  assert.equal(squareOAuthBase("production"), "https://connect.squareup.com/oauth2");
});

test("Sandbox authorization URL preserves redirect, state, scopes, and encoding", () => {
  const url = buildSquareAuthorizationUrl({ applicationId: "sandbox-sq0idb-example", redirectUri, state: "random_state-value", environment: "sandbox" });
  assert.equal(url.origin + url.pathname, SQUARE_OAUTH_AUTHORIZE_ENDPOINTS.sandbox);
  assert.equal(url.searchParams.get("client_id"), "sandbox-sq0idb-example");
  assert.equal(url.searchParams.get("redirect_uri"), redirectUri);
  assert.equal(url.searchParams.get("state"), "random_state-value");
  assert.equal(url.searchParams.get("scope"), SQUARE_SCOPES.join(" "));
  assert.equal(url.searchParams.has("session"), false);
  assert.match(url.toString(), /scope=MERCHANT_PROFILE_READ\+PAYMENTS_READ\+PAYMENTS_WRITE/);
});

test("Production authorization URL requires a new login session", () => {
  const url = buildSquareAuthorizationUrl({ applicationId: "sq0idp-example", redirectUri, state: "state", environment: "production" });
  assert.equal(url.origin + url.pathname, SQUARE_OAUTH_AUTHORIZE_ENDPOINTS.production);
  assert.equal(url.searchParams.get("session"), "false");
});

test("environment and application ID cannot be mixed", () => {
  assert.equal(squareTargetEnvironment("sandbox"), "sandbox");
  assert.equal(squareTargetEnvironment("production"), "production");
  assert.equal(squareApplicationMatchesEnvironment("sandbox-sq0idb-example", "sandbox"), true);
  assert.equal(squareApplicationMatchesEnvironment("sq0idp-example", "sandbox"), false);
  assert.equal(squareApplicationMatchesEnvironment("sandbox-sq0idb-example", "production"), false);
  assert.equal(squareApplicationMatchesEnvironment("sq0idp-example", "production"), true);
});
