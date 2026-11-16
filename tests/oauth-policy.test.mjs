import { test } from "node:test";
import assert from "node:assert/strict";
import { selectOAuthApplication, safePortalNext } from "../lib/oauth-policy.ts";

const app = { appKey: "signora", clientId: "signora-client", redirectUri: "https://signora.example.test/auth/portal/callback", allowedScopes: ["email", "profile"] };
const details = { authorization_id: "request", redirect_uri: app.redirectUri, client: { id: app.clientId, name: "Signora" }, user: { id: "member", email: "member@example.test" }, scope: "email profile" };

test("only a registered client, callback, identity and scope can authorize", () => {
  assert.equal(selectOAuthApplication(details, "member", [app]), app);
  for (const change of [
    { user: { id: "another-user" } }, { client: { id: "unknown" } },
    { redirect_uri: `${app.redirectUri}/other` }, { scope: "email phone" }, { scope: "" },
  ]) assert.equal(selectOAuthApplication({ ...details, ...change }, "member", [app]), null);
  assert.equal(selectOAuthApplication(details, "member", [app, app]), null);
});

test("prior consent must match the entire registered callback", () => {
  assert.equal(selectOAuthApplication({ redirect_url: `${app.redirectUri}?code=one-time&state=flow` }, "member", [app]), app);
  for (const callback of [
    "https://evil.test/auth/portal/callback?code=x",
    "http://signora.example.test/auth/portal/callback?code=x",
    "https://signora.example.test:444/auth/portal/callback?code=x",
    "https://signora.example.test/auth/portal/callback/other?code=x",
    "https://attacker@signora.example.test/auth/portal/callback?code=x",
    `${app.redirectUri}?code=x#fragment`, `${app.redirectUri}?code=x&code=y`,
    `${app.redirectUri}?code=x&state=a&state=b`, `${app.redirectUri}?code=x&next=https://evil.test`,
    `${app.redirectUri}?error=access_denied`, `${app.redirectUri}?state=x`, "not-a-url",
  ]) assert.equal(selectOAuthApplication({ redirect_url: callback }, "member", [app]), null, callback);
  assert.equal(selectOAuthApplication({ redirect_url: `${app.redirectUri}?code=x` }, "member", [app, { ...app, clientId: "another" }]), null);
});

test("callback fixed parameters cannot be removed, duplicated or changed", () => {
  const fixed = { ...app, redirectUri: `${app.redirectUri}?tenant=staff` };
  assert.equal(selectOAuthApplication({ redirect_url: `${fixed.redirectUri}&code=x&state=y` }, "member", [fixed]), fixed);
  for (const query of ["code=x", "tenant=other&code=x", "tenant=staff&tenant=other&code=x"]) {
    assert.equal(selectOAuthApplication({ redirect_url: `${app.redirectUri}?${query}` }, "member", [fixed]), null);
  }
});

test("unsafe configured callback URLs fail closed", () => {
  for (const redirectUri of ["javascript:alert(1)", "https://user:password@example.test/callback", `${app.redirectUri}#x`, `${app.redirectUri}?code=preset`]) {
    const invalid = { ...app, redirectUri };
    assert.equal(selectOAuthApplication({ ...details, redirect_uri: redirectUri }, "member", [invalid]), null);
  }
});

test("login continuation stays local after URL normalization", () => {
  assert.equal(safePortalNext("/%2e%2e//evil.test"), "/");
  for (const value of [null, "", "https://evil.test", "//evil.test", "/\\evil.test", "/%5cevil.test", "/%2f%2fevil.test", "/\t/evil.test", "/\n/evil.test"]) {
    assert.equal(safePortalNext(value), "/", String(value));
  }
  assert.equal(safePortalNext("/oauth/consent?authorization_id=test"), "/oauth/consent?authorization_id=test");
  assert.equal(safePortalNext("/work/../oauth/consent?authorization_id=test"), "/oauth/consent?authorization_id=test");
});
