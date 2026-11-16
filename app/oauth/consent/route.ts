import { NextResponse, type NextRequest } from "next/server";
import { currentMember, oauthApplications } from "@/lib/portal";
import { selectOAuthApplication } from "@/lib/oauth-policy";
import { supabaseServer } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store" };

export function HEAD() {
  return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: NextRequest) {
  if (request.headers.get("purpose")?.includes("prefetch") || request.headers.get("sec-purpose")?.includes("prefetch")
    || request.headers.has("next-router-prefetch")) return HEAD();
  const authorizationId = request.nextUrl.searchParams.get("authorization_id");
  if (!authorizationId) return new NextResponse("Missing authorization request. Return to the application and retry.", { status: 400, headers });
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `/oauth/consent?${new URLSearchParams({ authorization_id: authorizationId })}`);
    return NextResponse.redirect(login, { status: 307, headers });
  }
  const member = await currentMember();
  if (!member) return new NextResponse("This account does not have access to AI Deck.", { status: 403, headers });
  const apps = await oauthApplications();
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) return new NextResponse("Authorization request expired. Return to the application and retry.", { status: 400, headers });
  const app = selectOAuthApplication(data, user.id, apps);
  if (!app) return new NextResponse("This application is not authorized for connected access.", { status: 403, headers });
  const allowed = await supabase.rpc("aideck_can_access_app", { app_key: app.appKey });
  if (allowed.error || allowed.data !== true) return new NextResponse("This application is not assigned to you.", { status: 403, headers });
  const result = "redirect_url" in data
    ? { data, error: null }
    : await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true });
  if (result.error || !result.data || selectOAuthApplication(result.data, user.id, apps) !== app) {
    return new NextResponse("Authorization could not be completed. Return to the application and retry.", { status: 400, headers });
  }
  return NextResponse.redirect(result.data.redirect_url, { status: 302, headers });
}
