import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as adminUI from "../lib/admin-ui.ts";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const state = {
  member: { user_id: "admin-id", is_superadmin: false }, apps: ["signora"], members: [], assignments: [],
  reviewRows: [], queries: [],
};

function loadPage(filename, review = false) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const componentRequire = (name) => {
    if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
    if (name === "@/lib/admin-ui") return adminUI;
    if (name === "@/lib/db") return { db: () => ({ query: async (sql) => {
      state.queries.push(sql);
      if (sql.includes("select distinct m.*") || sql.includes("select * from aideck.members")) return { rows: state.members };
      if (sql.includes("from aideck.assignments a")) return { rows: state.assignments };
      if (sql.includes("from gtjbticketing.departments")) return { rows: [] };
      if (sql.includes("from signora.organizations")) return { rows: [] };
      if (sql.includes("from aideck.audit_events")) return { rows: [] };
      if (sql.includes("from signora.users") || sql.includes("from gtjbticketing.profiles")) return { rows: state.reviewRows };
      return { rows: [] };
    } }) };
    if (name === "@/lib/portal") return { requireAdministrator: async () => ({ member: state.member, apps: state.apps }) };
    if (name === "@/app/components/symbols") return { Icon: () => React.createElement("svg") };
    if (name === "@/app/admin/member-form") return { __esModule: true, default: () => React.createElement("div", null, "Member form") };
    if (name === "./member-form") return { __esModule: true, default: () => React.createElement("div", null, "Member form") };
    if (name === "./submit-button") return { __esModule: true, default: ({ children }) => React.createElement("button", null, children) };
    if (name === "./actions") return Object.fromEntries(["setVisibility", "retryProvision", "setSiteAdministrator", "addUpcomingApplication", "updateUpcomingApplication", "assignApplication", "setOrdinarySignoraRole"].map((key) => [key, async () => {}]));
    return require(name);
  };
  new Function("require", "module", "exports", code)(componentRequire, module, module.exports);
  return module.exports.default;
}

const adminPage = loadPage(resolve(root, "app/admin/page.tsx"));
const reviewPage = loadPage(resolve(root, "app/admin/existing/[source]/[id]/page.tsx"), true);
const render = async (page, props) => renderToStaticMarkup(await page(props));
const uuid = "550e8400-e29b-41d4-a716-446655440000";

test("catalog key native pattern accepts valid keys in modern browsers", async () => {
  state.member = { user_id: "admin-id", is_superadmin: true };
  state.members = [];
  state.assignments = [];
  state.reviewRows = [];
  const html = await render(adminPage, { searchParams: Promise.resolve({ section: "catalog" }) });
  const pattern = html.match(/<input(?=[^>]*name="key")[^>]*pattern="([^"]+)"/)?.[1];
  assert.ok(pattern);
  const validKey = new RegExp(`^(?:${pattern})$`, "v");
  for (const key of ["new-tool", "abc", "a12"]) assert.ok(validKey.test(key), key);
  for (const key of ["ab", "New-tool", "-tool", "a_tool", "a".repeat(42)]) assert.equal(validKey.test(key), false, key);
});

test("missing selected member shows a recoverable state with validated filters", async () => {
  state.member = { user_id: "admin-id", is_superadmin: false };
  state.apps = ["signora"];
  state.members = [];
  state.assignments = [];
  state.queries = [];
  const html = await render(adminPage, { searchParams: Promise.resolve({ section: "members", member: "missing", q: "Ada & Co", status: "active" }) });
  assert.match(html, /Member unavailable/);
  assert.match(html, /href="\/admin\?section=members&amp;q=Ada\+%26\+Co&amp;status=active"/);
});

test("member details preserve filters in back links and action forms", async () => {
  state.member = { user_id: "admin-id", is_superadmin: false };
  state.apps = ["signora"];
  state.members = [{ user_id: uuid, full_name: "Ada Example", email: "ada@example.test", status: "active", kind: "staff", is_superadmin: false, department: "Audit" }];
  state.assignments = [{ user_id: uuid, app_key: "signora", site_role: "junior", can_manage: false, visible: true, provision_status: "ready", provision_error: null }];
  state.queries = [];
  const html = await render(adminPage, { searchParams: Promise.resolve({ section: "members", member: uuid, q: "Ada", status: "active" }) });
  assert.match(html, /href="\/admin\?section=members&amp;q=Ada&amp;status=active"/);
  assert.match(html, /<input type="hidden" name="q" value="Ada"\/>/);
  assert.match(html, /<input type="hidden" name="status" value="active"\/>/);
});

test("review route renders forbidden, invalid UUID, and missing user states before unsafe queries", async () => {
  state.queries = [];
  state.member = { user_id: "admin-id", is_superadmin: false };
  const forbidden = await render(reviewPage, { params: Promise.resolve({ source: "signora", id: uuid }), searchParams: Promise.resolve({}) });
  assert.match(forbidden, /Super administrator access required/);
  assert.equal(state.queries.length, 0);

  state.member = { user_id: "admin-id", is_superadmin: true };
  const invalid = await render(reviewPage, { params: Promise.resolve({ source: "signora", id: "not-a-uuid" }), searchParams: Promise.resolve({ q: "Ada", status: "active" }) });
  assert.match(invalid, /Invalid user identifier/);
  assert.equal(state.queries.length, 0);

  state.reviewRows = [];
  const missing = await render(reviewPage, { params: Promise.resolve({ source: "signora", id: uuid }), searchParams: Promise.resolve({}) });
  assert.match(missing, /User not found/);
  assert.match(missing, /href="\/admin\?section=existing"/);
  assert.equal(state.queries.length, 1);
});
