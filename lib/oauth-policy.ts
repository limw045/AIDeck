import type { OAuthAuthorizationDetails, OAuthRedirect } from "@supabase/supabase-js";

export type OAuthApplication = {
  appKey: string;
  clientId: string;
  redirectUri: string;
  allowedScopes: string[];
};

function callbackUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash
      || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) return null;
    return url;
  } catch { return null; }
}

export function selectOAuthApplication(details: OAuthAuthorizationDetails | OAuthRedirect, userId: string, apps: OAuthApplication[]): OAuthApplication | null {
  const matches = apps.filter((app) => {
    const expected = callbackUrl(app.redirectUri);
    if (!expected || ["code", "state", "error", "error_description"].some((key) => expected.searchParams.has(key))) return false;
    if ("authorization_id" in details) {
      const scopes = details.scope.trim().split(/\s+/);
      return details.user?.id === userId && details.client?.id === app.clientId
        && details.redirect_uri === app.redirectUri && scopes.every((scope) => scope && app.allowedScopes.includes(scope));
    }
    const actual = callbackUrl(details.redirect_url);
    if (!actual || actual.origin !== expected.origin || actual.pathname !== expected.pathname
      || !actual.searchParams.get("code")) return false;
    for (const key of new Set([...actual.searchParams.keys(), ...expected.searchParams.keys()])) {
      const values = actual.searchParams.getAll(key);
      if (key === "code" || key === "state") {
        if (values.length !== 1 || !values[0]) return false;
      } else if (JSON.stringify(values) !== JSON.stringify(expected.searchParams.getAll(key)) || !expected.searchParams.has(key)) return false;
    }
    return true;
  });
  return matches.length === 1 ? matches[0] : null;
}

export function safePortalNext(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\s\u0000-\u001f\u007f]/.test(value)
    || /%2f|%5c/i.test(value.split(/[?#]/, 1)[0])) return "/";
  try {
    const url = new URL(value, "https://portal.invalid");
    return url.origin === "https://portal.invalid" && !url.pathname.startsWith("//")
      ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch { return "/"; }
}
