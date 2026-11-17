function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function httpErrorResponse(request: Request, status: number, message: string, headers: HeadersInit = {}) {
  const acceptsHtml = request.headers.get("accept")?.split(",").some((mediaRange) => {
    const [type, ...parameters] = mediaRange.trim().toLowerCase().split(";");
    const quality = parameters.find((parameter) => parameter.trim().startsWith("q="));
    return type === "text/html" && (!quality || Number(quality.trim().slice(2)) > 0);
  });
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", acceptsHtml ? "text/html; charset=utf-8" : "text/plain; charset=utf-8");
  const vary = responseHeaders.get("Vary");
  const varyValues = vary?.split(",").map((value) => value.trim().toLowerCase());
  if (!varyValues?.includes("*") && !varyValues?.includes("accept")) responseHeaders.set("Vary", vary ? `${vary}, Accept` : "Accept");
  const body = acceptsHtml
    ? `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AIDeck · Request unavailable</title><style>
:root{color-scheme:light dark;--page:#f8f7fa;--surface:#fff;--ink:#18141d;--muted:#625c68;--brand:#4f2d7f;--brand-hover:#43246d;--line:#e5e1e8}
@media(prefers-color-scheme:dark){:root{--page:#101019;--surface:#191822;--ink:#f5f4f7;--muted:#b6b1be;--brand:#7655bd;--brand-hover:#6848ac;--line:#35303f}}
*{box-sizing:border-box}body{min-height:100vh;margin:0;padding:24px;display:grid;place-items:center;background:var(--page);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(100%,480px);padding:clamp(24px,6vw,42px);background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:0 12px 40px #20102b12}
h1{margin:0 0 12px;font-size:clamp(25px,6vw,32px);line-height:1.2;letter-spacing:-.035em}p{margin:0 0 28px;color:var(--muted);overflow-wrap:anywhere}
a{display:inline-flex;min-height:46px;align-items:center;justify-content:center;padding:0 18px;border-radius:8px;background:var(--brand);color:#fff;text-decoration:none;font-weight:600}a:hover{background:var(--brand-hover)}a:focus-visible{outline:3px solid #b9a4dc;outline-offset:3px}
</style></head><body><main><h1>Request unavailable</h1><p>${escapeHtml(message)}</p><a href="/">Return to AIDeck</a></main></body></html>`
    : message;
  return new Response(body, { status, headers: responseHeaders });
}
