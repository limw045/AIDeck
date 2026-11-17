import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));

test("Full code preview fits both dimensions and preserves deliberate zoom", () => {
  const html = readFileSync(resolve(root, "assets/qr-studio/index.html"), "utf8");
  const zoom = html.match(/function applyZoom\(\) \{([\s\S]*?)\n\}\nasync function raster/)[1];
  const attributes = {};
  const mat = { clientWidth: 420, clientHeight: 190 };
  const paper = { style: {}, parentElement: mat, querySelector: () => ({ setAttribute: (name, value) => { attributes[name] = value; } }), setAttribute() {} };
  const choice = { value: "100" };
  const context = vm.createContext({ state: { frame: "rounded" }, $: (id) => id === "preview" ? paper : choice, getComputedStyle: (element) => element === mat ? { paddingLeft: "22px", paddingRight: "22px", paddingTop: "22px", paddingBottom: "22px" } : { width: "280px" } });
  const apply = () => vm.runInContext(`(() => {${zoom}})()`, context);
  apply();
  assert.ok(parseFloat(paper.style.width) * 448 / 400 <= 146.01, "framed artwork must fit within the padded mat height");
  const fullWidth = parseFloat(paper.style.width);
  choice.value = "150";
  apply();
  assert.equal(parseFloat(paper.style.width), fullWidth * 1.5);
  choice.value = "100";
  context.state.frame = "none";
  apply();
  assert.equal(parseFloat(paper.style.width), 146);
  mat.clientWidth = 150;
  apply();
  assert.equal(parseFloat(paper.style.width), 106, "narrow previews must also fit their available width");
  choice.value = "detail";
  apply();
  assert.equal(attributes.viewBox, "80 100 100 100");
});

test("canceling QR reset preserves the design and confirming returns to the initial state", () => {
  const html = readFileSync(resolve(root, "assets/qr-studio/index.html"), "utf8");
  const reset = html.match(/\$\('reset'\)\.addEventListener\('click',\(\)=>\{([\s\S]*?)\n\}\);/)[1];
  const elements = new Map();
  const context = vm.createContext({
    initial: { frame: "rounded" }, state: { frame: "classic" }, logoRevision: 0, encoded: "previous",
    confirm: () => false,
    $: (id) => {
      if (!elements.has(id)) elements.set(id, { value: id === "url" ? "https://example.com" : "", removeAttribute() {}, focus() {} });
      return elements.get(id);
    },
    syncControls() {}, selectTab() {}, render() {},
  });
  vm.runInContext(`(() => {${reset}})()`, context);
  assert.equal(context.state.frame, "classic");
  assert.equal(context.$("url").value, "https://example.com");
  assert.equal(context.logoRevision, 0);
  context.confirm = () => true;
  vm.runInContext(`(() => {${reset}})()`, context);
  assert.equal(context.state.frame, "rounded");
  assert.equal(context.$("url").value, "");
  assert.equal(context.$("filename").value, "qr-code");
});

test("invalid QR inputs and insufficient contrast keep both export formats disabled", async () => {
  const html = readFileSync(resolve(root, "assets/qr-studio/index.html"), "utf8");
  const render = html.match(/async function render\(\) \{([\s\S]*?)\n\}\nfunction schedule/)[1];
  const context = vm.createContext({
    revision: 0, currentSvg: "old", ready: true,
    $: () => ({ value: "not-empty", textContent: "", setAttribute() {}, classList: { add() {} } }),
    enableDownloads: (ready) => { context.ready = ready; },
    status() {},
    urlValue: () => { throw new Error("Invalid URL"); },
  });
  await vm.runInContext(`(async () => {${render}})()`, context);
  assert.equal(context.ready, false);
  assert.equal(context.currentSvg, "");
  Object.assign(context, {
    urlValue: () => "https://example.com",
    getOptions: () => ({ frame: "none", gradient: "none", eyeCustom: false, foreground: "#FFFFFF", background: "#FFFFFF" }),
    colorFields: [], hex: () => true, luminance: () => 1,
  });
  context.ready = true;
  await vm.runInContext(`(async () => {${render}})()`, context);
  assert.equal(context.ready, false);
});

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
