import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { Client } from "pg";

const portal = process.env.SSO_PORTAL_URL;
const url = process.env.SSO_TEST_SUPABASE_URL;
const database = process.env.SSO_TEST_DATABASE_URL;

test("portal automatically authorizes only active assigned internal users", { skip: !portal || !url || !database }, async (t) => {
  for (const value of [portal, url, database]) assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname));
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const admin = createClient(url, process.env.SSO_TEST_SECRET_KEY, options);
  const db = new Client({ connectionString: database });
  await db.connect();
  const email = `portal-${randomBytes(8).toString("hex")}@example.test`;
  const password = randomBytes(24).toString("base64url");
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  const userId = created.data.user.id;
  const cookies = new Map();
  const auth = createServerClient(url, process.env.SSO_TEST_PUBLISHABLE_KEY, {
    cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: (items) => items.forEach(({ name, value }) => cookies.set(name, value)) },
  });
  assert.ifError((await auth.auth.signInWithPassword({ email, password })).error);
  const headers = { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") };
  const redirectUri = "http://localhost:49301/auth/portal/callback";
  const registered = await admin.auth.admin.oauth.createClient({ client_name: "Portal test", client_type: "confidential", redirect_uris: [redirectUri], token_endpoint_auth_method: "client_secret_basic" });
  assert.ifError(registered.error);
  const client = registered.data;
  async function request() {
    const authorize = new URL(`${url}/auth/v1/oauth/authorize`);
    authorize.search = new URLSearchParams({ client_id: client.client_id, redirect_uri: redirectUri, response_type: "code", scope: "email profile", state: randomBytes(16).toString("hex"), code_challenge: createHash("sha256").update(randomBytes(32).toString("base64url")).digest("base64url"), code_challenge_method: "S256" }).toString();
    const start = await fetch(authorize, { redirect: "manual" });
    assert.equal(start.status, 302);
    const location = new URL(start.headers.get("location"));
    assert.equal(location.pathname, "/oauth/consent");
    // The local HTTPS browser fixture and Node transport reach the same portal.
    return new URL(location.pathname + location.search, portal).toString();
  }
  const visit = (location, extra = {}) => fetch(location, { headers: { ...headers, ...extra }, redirect: "manual" });
  try {
    await db.query("insert into aideck.members(user_id,email,full_name,department,employee_type,kind,status) values($1,$2,'SSO test','Test','full_time','staff','active')", [userId, email]);
    await db.query("insert into aideck.assignments(user_id,app_key,visible,provision_status) values($1,'signora',true,'ready')", [userId]);
    await db.query("insert into aideck.oauth_clients(app_key,client_id,redirect_uri,allowed_scopes,enabled) values('signora',$1,$2,array['email','profile'],true)", [client.client_id, redirectUri]);
    await t.test("missing request and unauthenticated continuation fail safely", async () => {
      assert.equal((await visit(`${portal}/oauth/consent`)).status, 400);
      const location = await request();
      const response = await fetch(location, { redirect: "manual" });
      assert.equal(response.status, 307);
      const login = new URL(response.headers.get("location"));
      assert.equal(login.pathname, "/login");
      assert.equal(login.searchParams.get("next"), new URL(location).pathname + new URL(location).search);
    });
    await t.test("first entry needs no approval and emits an uncached registered callback", async () => {
      const location = await request();
      const response = await visit(location);
      assert.equal(response.status, 302);
      const callback = new URL(response.headers.get("location"));
      assert.equal(callback.origin + callback.pathname, redirectUri);
      assert.ok(callback.searchParams.get("code"));
      assert.match(response.headers.get("cache-control"), /no-store/);
      assert.equal((await visit(location)).status, 400, "Consumed requests must not silently replay");
    });
    await t.test("previous consent still enforces current assignment", async () => {
      const location = await request();
      const id = new URL(location).searchParams.get("authorization_id");
      const details = await auth.auth.oauth.getAuthorizationDetails(id);
      assert.ifError(details.error);
      if ("authorization_id" in details.data) assert.ifError((await auth.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true })).error);
      await db.query("update aideck.assignments set visible=false where user_id=$1", [userId]);
      try { assert.equal((await visit(await request())).status, 403); }
      finally { await db.query("update aideck.assignments set visible=true where user_id=$1", [userId]); }
    });
    for (const [name, query, restore] of [
      ["suspended member", "update aideck.members set status='suspended' where user_id=$1", "update aideck.members set status='active' where user_id=$1"],
      ["pending assignment", "update aideck.assignments set provision_status='pending' where user_id=$1", "update aideck.assignments set provision_status='ready' where user_id=$1"],
    ]) {
      await t.test(`denies ${name}`, async () => {
        await db.query(query, [userId]);
        try { assert.equal((await visit(await request())).status, 403); }
        finally { await db.query(restore, [userId]); }
      });
    }
    await t.test("disabled mappings cannot authorize", async () => {
      await db.query("update aideck.oauth_clients set enabled=false where app_key='signora'");
      try { assert.equal((await visit(await request())).status, 403); }
      finally { await db.query("update aideck.oauth_clients set enabled=true where app_key='signora'"); }
    });
    await t.test("prefetch and HEAD cannot consume a pending authorization", async () => {
      const location = await request();
      assert.equal((await visit(location, { purpose: "prefetch" })).status, 204);
      assert.equal((await fetch(location, { method: "HEAD", headers, redirect: "manual" })).status, 204);
      assert.equal((await visit(location)).status, 302);
    });
  } finally {
    await db.query("delete from aideck.oauth_clients where client_id=$1", [client.client_id]);
    await admin.auth.admin.oauth.deleteClient(client.client_id);
    await admin.auth.admin.deleteUser(userId);
    await db.end();
  }
});
