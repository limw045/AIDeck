import { test } from "node:test";
import assert from "node:assert/strict";
import { httpErrorResponse } from "../lib/http-error.ts";

test("browser errors are escaped HTML with a local return link and uncached status", async () => {
  const request = new Request("https://portal.example/oauth/consent", { headers: { accept: "text/html,application/xhtml+xml" } });
  const response = httpErrorResponse(request, 403, "<script>alert('x')</script> & access denied", { "Cache-Control": "no-store", Vary: "Origin" });
  const body = await response.text();

  assert.equal(response.status, 403);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("vary"), "Origin, Accept");
  assert.match(body, /&lt;script&gt;alert\(&#39;x&#39;\)&lt;\/script&gt; &amp; access denied/);
  assert.doesNotMatch(body, /<script>/i);
  assert.match(body, /href="\/"/);
  assert.match(body, /<title>AIDeck · Request unavailable<\/title>/);
  assert.match(body, /@media\(prefers-color-scheme:dark\)/);
  assert.match(body, /background:var\(--brand\)/);
  assert.doesNotMatch(body, /https?:\/\//);
});

test("non-HTML and explicitly declined HTML callers keep plain text", async () => {
  for (const accept of ["application/json", "text/html;q=0,application/json"]) {
    const request = new Request("https://portal.example/api/download", { headers: { accept } });
    const response = httpErrorResponse(request, 401, "Sign in to download.", { "Cache-Control": "private, no-store" });
    assert.equal(response.status, 401);
    assert.match(response.headers.get("content-type"), /text\/plain/);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("vary"), "Accept");
    assert.equal(await response.text(), "Sign in to download.");
  }
});

test("Vary keeps existing values without duplicating Accept or wildcard", () => {
  const request = new Request("https://portal.example/", { headers: { accept: "text/html" } });
  assert.equal(httpErrorResponse(request, 400, "Bad request", { Vary: "Accept, Origin" }).headers.get("vary"), "Accept, Origin");
  assert.equal(httpErrorResponse(request, 400, "Bad request", { Vary: "*" }).headers.get("vary"), "*");
});
