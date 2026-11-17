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
const modules = new Map();

function loadComponent(filename) {
  if (modules.has(filename)) return modules.get(filename);
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const componentRequire = (name) => {
    if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
    if (name === "./actions") return { inviteMember: async () => {}, approveExisting: async () => {} };
    if (name === "@/lib/admin-ui") return adminUI;
    if (name.startsWith("@/")) return loadComponent(resolve(root, `${name.slice(2)}.tsx`));
    if (name.startsWith("./")) return loadComponent(resolve(dirname(filename), `${name}.tsx`));
    return require(name);
  };
  new Function("require", "module", "exports", code)(componentRequire, module, module.exports);
  modules.set(filename, module.exports);
  return module.exports;
}

const MemberForm = loadComponent(resolve(root, "app/admin/member-form.tsx")).default;
const MemberDepartmentFields = loadComponent(resolve(root, "app/admin/member-department-fields.tsx")).default;
const options = { departments: [{ id: "department", name: "Audit" }], organizations: [{ id: "org", name: "Example organization" }], apps: ["signora", "ticketing", "riskscreen"], allowClient: true };
const render = (props) => renderToStaticMarkup(React.createElement(MemberForm, { ...options, ...props }));

test("staff invitations show automatic Ticketing and honor administrator scope", () => {
  const html = render({ apps: ["signora"], allowClient: false });
  const ticketing = html.match(/<input(?=[^>]*value="ticketing")[^>]*>/)?.[0];
  assert.match(ticketing, /disabled=""/);
  assert.match(ticketing, /checked=""/);
  assert.doesNotMatch(html, /<select[^>]*name="kind"/);
  assert.doesNotMatch(html, /value="riskscreen"/);
  assert.doesNotMatch(html, /name="organizationId"/);
  assert.match(html, /name="ticketingDepartmentId"[^>]*required=""/);
});

test("existing Signora approval preserves identity, role and organization", () => {
  for (const role of ["junior", "superadmin"]) {
    const existing = { id: "existing-user", email: "member@example.test", name: "Example Member", role, source: "signora", organization_id: role === "superadmin" ? null : "org", department_id: "department" };
    const html = render({ existing });
    assert.match(html, /<input(?=[^>]*name="email")(?=[^>]*readOnly="")[^>]*>/);
    assert.match(html, /name="userId" value="existing-user"/);
    assert.match(html, new RegExp(`name="signoraRole" value="${role}"`));
    assert.match(html, /<select[^>]*name="organizationId"[^>]*disabled=""/);
    assert.doesNotMatch(html, /<select[^>]*name="signoraRole"/);
    if (role === "superadmin") assert.doesNotMatch(html, /<select[^>]*name="organizationId"[^>]*required=""/);
    assert.match(html, /href="\/admin\?section=existing"/);
  }
});

test("client invite hides employment choices and submits the required full-time default", () => {
  const html = renderToStaticMarkup(React.createElement(MemberDepartmentFields, {
    departments: [], allowClient: true, kind: "client", onKindChange() {}, ticketingSelected: false,
  }));
  assert.match(html, /<input type="hidden" name="employeeType" value="full_time"\/>/);
  assert.doesNotMatch(html, /<select[^>]*name="employeeType"/);
});
