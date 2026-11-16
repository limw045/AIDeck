import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

const url = process.env.SSO_TEST_SUPABASE_URL;
const database = process.env.SSO_TEST_DATABASE_URL;

test("isolated OAuth tokens enforce caller-only application access", { skip: !url || !database }, async (t) => {
  for (const value of [url, database]) {
    assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname), "Only a disposable loopback test stack is allowed");
  }
  const publicKey = process.env.SSO_TEST_PUBLISHABLE_KEY;
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const admin = createClient(url, process.env.SSO_TEST_SECRET_KEY, options);
  const db = new Client({ connectionString: database });
  await db.connect();
  const users = [];
  const clients = [];
  try {
    assert.equal((await db.query("select public.aideck_can_access_app(null) as allowed")).rows[0].allowed, false);
    for (let i = 0; i < 2; i++) {
      const password = randomBytes(24).toString("base64url");
      const email = `sso-${randomBytes(8).toString("hex")}@example.test`;
      const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.ifError(result.error);
      const id = result.data.user.id;
      users.push(id);
      const auth = createClient(url, publicKey, options);
      assert.ifError((await auth.auth.signInWithPassword({ email, password })).error);
      await db.query("insert into aideck.members(user_id,email,full_name,department,employee_type,kind,status) values($1,$2,'SSO test','Test','full_time','staff','active')", [id, email]);
      users[i] = { id, auth };
    }
    await db.query("insert into aideck.assignments(user_id,app_key,visible,provision_status) values($1,'signora',true,'ready'),($1,'ticketing',true,'ready')", [users[0].id]);
    for (const app of ["signora", "ticketing"]) {
      const redirectUri = `http://localhost:5830${app === "signora" ? "1" : "2"}/auth/portal/callback`;
      const result = await admin.auth.admin.oauth.createClient({ client_name: `SSO ${app}`, client_type: "confidential", redirect_uris: [redirectUri], token_endpoint_auth_method: "client_secret_basic" });
      assert.ifError(result.error);
      const client = { ...result.data, app, redirectUri };
      clients.push(client);
      await db.query("insert into aideck.oauth_clients(app_key,client_id,redirect_uri,allowed_scopes,enabled) values($1,$2,$3,array['email','profile'],true)", [app, client.client_id, redirectUri]);
    }
    async function tokenFor(user, client) {
      const verifier = randomBytes(32).toString("base64url");
      const authorize = new URL(`${url}/auth/v1/oauth/authorize`);
      authorize.search = new URLSearchParams({ client_id: client.client_id, redirect_uri: client.redirectUri, response_type: "code", scope: "email profile", state: randomBytes(16).toString("hex"), code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
      const start = await fetch(authorize, { redirect: "manual" });
      assert.equal(start.status, 302);
      const id = new URL(start.headers.get("location")).searchParams.get("authorization_id");
      const details = await user.auth.auth.oauth.getAuthorizationDetails(id);
      assert.ifError(details.error);
      const approved = "redirect_url" in details.data ? details : await user.auth.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true });
      assert.ifError(approved.error);
      const code = new URL(approved.data.redirect_url).searchParams.get("code");
      assert.ok(code);
      const response = await fetch(`${url}/auth/v1/oauth/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${client.client_id}:${client.client_secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: client.redirectUri, code_verifier: verifier }) });
      assert.equal(response.status, 200, "Real OAuth code exchange must succeed");
      const tokens = await response.json();
      assert.ok(tokens.access_token);
      return tokens.access_token;
    }
    const tokenA = await tokenFor(users[0], clients[0]);
    const tokenB = await tokenFor(users[1], clients[0]);
    const ticketingToken = await tokenFor(users[0], clients[1]);
    async function canAccess(token, appKey) {
      const response = await fetch(`${url}/rest/v1/rpc/aideck_can_access_app`, { method: "POST", headers: { apikey: publicKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ app_key: appKey }) });
      assert.equal(response.status, 200, "OAuth token must be accepted by PostgREST");
      return response.json();
    }
    await t.test("real OAuth identity gets only its assigned client's access", async () => {
      assert.equal(await canAccess(tokenA, "signora"), true);
      assert.equal(await canAccess(tokenB, "signora"), false);
      assert.equal(await canAccess(ticketingToken, "signora"), false);
      assert.equal(await canAccess(tokenA, "unknown"), false);
      assert.equal(await canAccess(tokenA, null), false);
    });
    for (const [name, sql, restore] of [
      ["hidden assignment", "update aideck.assignments set visible=false where user_id=$1", "update aideck.assignments set visible=true where user_id=$1"],
      ["pending provisioning", "update aideck.assignments set provision_status='pending' where user_id=$1", "update aideck.assignments set provision_status='ready' where user_id=$1"],
      ["suspended member", "update aideck.members set status='suspended' where user_id=$1", "update aideck.members set status='active' where user_id=$1"],
    ]) {
      await t.test(`denies ${name} with an already-issued token`, async () => {
        await db.query(sql, [users[0].id]);
        try { assert.equal(await canAccess(tokenA, "signora"), false); }
        finally { await db.query(restore, [users[0].id]); }
      });
    }
    for (const table of ["applications", "oauth_clients"]) {
      await t.test(`denies disabled ${table}`, async () => {
        const key = table === "applications" ? "key" : "app_key";
        await db.query(`update aideck.${table} set enabled=false where ${key}='signora'`);
        try { assert.equal(await canAccess(tokenA, "signora"), false); }
        finally { await db.query(`update aideck.${table} set enabled=true where ${key}='signora'`); }
      });
    }
    await t.test("anonymous callers and direct private-table reads are denied", async () => {
      const response = await fetch(`${url}/rest/v1/rpc/aideck_can_access_app`, { method: "POST", headers: { apikey: publicKey, "Content-Type": "application/json" }, body: JSON.stringify({ app_key: "signora" }) });
      assert.ok([401, 403, 404].includes(response.status), `Anonymous request returned ${response.status}`);
      assert.equal((await db.query("select has_function_privilege('anon','public.aideck_can_access_app(text)','execute') as allowed")).rows[0].allowed, false);
      await db.query("begin");
      try {
        await db.query("set local role authenticated");
        await assert.rejects(db.query("select * from aideck.members"), { code: "42501" });
      } finally { await db.query("rollback"); }
    });
    await t.test("an input UUID cannot select another caller", async () => {
      const response = await fetch(`${url}/rest/v1/rpc/aideck_can_access_app`, { method: "POST", headers: { apikey: publicKey, Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" }, body: JSON.stringify({ app_key: "signora", user_id: users[0].id }) });
      assert.equal(response.status, 404);
    });
  } finally {
    for (const client of clients) {
      await db.query("delete from aideck.oauth_clients where client_id=$1", [client.client_id]);
      await admin.auth.admin.oauth.deleteClient(client.client_id);
    }
    for (const user of users) await admin.auth.admin.deleteUser(typeof user === "string" ? user : user.id);
    await db.end();
  }
});
