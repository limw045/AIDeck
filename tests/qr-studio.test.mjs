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
  new Function("require", "module", "exports", code)((name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("./")) return load(resolve(dirname(filename), `${name}.tsx`), mocks);
    return require(name);
  }, module, module.exports);
  return module.exports;
}

test("QR Studio is visible without assignments and preserves assigned applications", async () => {
  for (const assigned of [[], [{ key: "signora", name: "Signora", kind: "web" }]]) {
    const portal = load(resolve(root, "lib/portal.ts"), {
      "@/lib/db": { db: () => ({ query: async () => ({ rows: assigned }) }) },
      "@/lib/supabase/server": {},
      "next/navigation": {},
    });
    const apps = await portal.visibleApplications({ user_id: "member-without-grants" });
    assert.deepEqual(apps.slice(0, -1), assigned);
    const qr = apps.at(-1);
    assert.equal(qr.key, "qrstudio");
    assert.equal(qr.kind, "web");
    assert.equal(qr.url, "/qr-studio");
    const { ApplicationCatalog } = load(resolve(root, "app/components/application-catalog.tsx"), {
      "@/app/actions": { launchApplication: async () => {} },
    });
    const html = renderToStaticMarkup(React.createElement(ApplicationCatalog, { applications: [qr], oauthReady: {}, downloadReady: false }));
    assert.match(html, /href="\/qr-studio"/);
    assert.doesNotMatch(html, /<form|Separate sign-in required|Coming soon|Download installer/);
  }
});

test("QR Studio checks membership before loading the editor inside the shared workspace", async () => {
  let allowed = false;
  let reads = 0;
  const { default: Page } = load(resolve(root, "app/qr-studio/page.tsx"), {
    "@/lib/portal": {
      requireMember: async () => { if (!allowed) throw new Error("login required"); return { is_superadmin: false }; },
      managedApps: async () => [],
    },
    "node:fs/promises": { readFile: async (filename, encoding) => { reads++; return readFileSync(filename, encoding); } },
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "@/app/components/workspace-shell": { WorkspaceShell: "workspace-shell" },
    "./qr-studio": { QRStudio: "qr-editor" },
    "./qr-studio.css": {},
  });
  await assert.rejects(Page(), /login required/);
  assert.equal(reads, 0);
  allowed = true;
  const page = await Page();
  assert.equal(page.type, "workspace-shell");
  assert.equal(page.props.canAdmin, false);
  const editor = page.props.children.find(child => child.type === "qr-editor");
  const html = editor.props.html;
  assert.doesNotMatch(html, /<header>|<h1>/);
  assert.match(html, /var\(--brand/);
  assert.match(html, /Third-party browser library licenses/);
  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(html, /<script[^>]+src=|__GT_|__QRCODE__|__APP__/);
  assert.match(html, /a\.download=filename/);
});

test("workspace navigation selects only the current application or administration page", () => {
  for (const [pathname, label] of [["/", "My applications"], ["/qr-studio", "QR Studio"], ["/admin", "Administration"]]) {
    const { WorkspaceShell } = load(resolve(root, "app/components/workspace-shell.tsx"), {
      "next/navigation": { usePathname: () => pathname },
      "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
      "@/app/actions": { signOutEverywhere: async () => {} },
    });
    const html = renderToStaticMarkup(React.createElement(WorkspaceShell, {
      member: { full_name: "Portal Member", department: "AI Department", is_superadmin: false }, canAdmin: true,
    }));
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    assert.match(html, new RegExp(`<strong>${label}</strong>`));
    assert.match(html, /href="\/qr-studio"/);
  }
});
