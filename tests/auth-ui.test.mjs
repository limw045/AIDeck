import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));

function load(filename, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const componentRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("./")) return load(resolve(dirname(filename), `${name}.tsx`), mocks);
    if (name.startsWith("@/")) return load(resolve(root, `${name.slice(2)}.tsx`), mocks);
    return require(name);
  };
  new Function("require", "module", "exports", code)(componentRequire, module, module.exports);
  return module.exports;
}

const Icon = ({ name }) => React.createElement("span", { "data-icon": name, "aria-hidden": "true" });
const render = (element) => renderToStaticMarkup(element);

test("login labels exclude reveal controls and invite feedback is allowlisted", async () => {
  const LoginForm = load(resolve(root, "app/login/login-form.tsx"), {
    "@/lib/supabase/browser": { supabaseBrowser: () => ({}) },
    "@/app/components/symbols": { Icon },
    "@/lib/oauth-policy": { safePortalNext: () => "/" },
  }).default;
  const html = render(React.createElement(LoginForm));

  assert.match(html, /<label for="password">Password<\/label>/);
  assert.match(html, /aria-label="Show password"/);
  assert.match(html, /class="auth-field"/);
  assert.match(render(React.createElement(LoginForm, { inviteError: "Invitation is invalid." })), /class="error auth-error" role="alert"/);

  const LoginPage = load(resolve(root, "app/login/page.tsx"), {
    "./login-form": { __esModule: true, default: ({ inviteError }) => React.createElement("output", null, inviteError ?? "") },
    "@/app/components/auth-shell": { AuthShell: ({ children }) => React.createElement("main", null, children) },
    "@/app/components/symbols": { Icon },
  }).default;
  const missingCode = render(await LoginPage({ searchParams: Promise.resolve({ error: "missing-code" }) }));
  const invalidInvite = render(await LoginPage({ searchParams: Promise.resolve({ error: "invalid-invite" }) }));
  const arbitrary = render(await LoginPage({ searchParams: Promise.resolve({ error: "<script>bad</script>" }) }));

  assert.match(missingCode, /invitation link is incomplete/i);
  assert.match(invalidInvite, /invitation link is no longer valid/i);
  assert.doesNotMatch(missingCode, /invalid/);
  assert.doesNotMatch(arbitrary, /<script>|bad/);
});

test("password setup describes requirements and exposes separate reveal buttons", () => {
  const PasswordForm = load(resolve(root, "app/set-password/password-form.tsx"), {
    "next/navigation": { useRouter: () => ({ replace() {}, refresh() {} }) },
    "@/lib/supabase/browser": { supabaseBrowser: () => ({}) },
  }).default;
  const html = render(React.createElement(PasswordForm));

  assert.match(html, /id="password"/);
  assert.match(html, /id="confirmPassword"/);
  assert.equal((html.match(/class="password-toggle"/g) ?? []).length, 2);
  assert.match(html, /At least 8 characters\./);
  assert.match(html, /aria-label="Show new password"/);
  assert.match(html, /aria-label="Show confirmation password"/);
});

test("restricted access page has page-specific metadata and clear recovery steps", () => {
  const page = load(resolve(root, "app/not-invited/page.tsx"), {
    "@/app/actions": { signOutEverywhere() {} },
    "@/app/components/auth-shell": { AuthShell: ({ children }) => React.createElement("main", null, children) },
    "@/app/components/symbols": { Icon },
  });
  const html = render(React.createElement(page.default));

  assert.equal(page.metadata.title, "Access unavailable");
  assert.match(html, /Contact your administrator/);
  assert.match(html, /Sign out and sign in again/);
});

test("missing pages offer the shared recovery surface and a local workspace link", () => {
  const page = load(resolve(root, "app/not-found.tsx"), {
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "@/app/components/auth-shell": { AuthShell: ({ children }) => React.createElement("main", null, children) },
    "@/app/components/symbols": { Icon },
  });
  const html = render(React.createElement(page.default));
  assert.equal(page.metadata.title, "Page not found");
  assert.match(html, /<h1>Page not found<\/h1>/);
  assert.match(html, /href="\/">Return to AIDeck/);
});
