import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { supabaseServer } from "@/lib/supabase/server";
import { selectInstaller } from "@/lib/riskscreen-release";
import { httpErrorResponse } from "@/lib/http-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(request: Request, status: number, message: string) {
  return httpErrorResponse(request, status, message, { "Cache-Control": "private, no-store" });
}

export async function GET(request: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return error(request, 401, "Sign in to download RiskScreen.");
  const access = await db().query<{ status: string }>(
    `select m.status from aideck.members m join aideck.assignments a on a.user_id=m.user_id
     where m.user_id=$1 and a.app_key='riskscreen' and a.visible and a.provision_status='ready'`, [user.id],
  );
  if (!access.rows[0] || access.rows[0].status === "suspended") return error(request, 403, "RiskScreen is not assigned to this account.");
  if (access.rows[0].status === "invited") {
    await db().query("update aideck.members set status='active',updated_at=now() where user_id=$1 and status='invited'", [user.id]);
  }

  const owner = process.env.GITHUB_RELEASE_OWNER;
  const repo = process.env.GITHUB_RELEASE_REPO;
  const token = process.env.GITHUB_RELEASE_TOKEN;
  if (!owner || !repo || !token || !/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) {
    return error(request, 503, "RiskScreen downloads are not configured.");
  }
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = { Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "AIDeck-Portal", Accept: "application/vnd.github+json" };
  const latest = await fetch(`${base}/releases/latest`, { headers, cache: "no-store" });
  if (!latest.ok) return error(request, 502, "Could not load the RiskScreen release.");
  const asset = selectInstaller(await latest.json());
  if (!asset) return error(request, 502, "No verified stable RiskScreen installer is available.");
  const download = await fetch(`${base}/releases/assets/${asset.id}`, {
    headers: { ...headers, Accept: "application/octet-stream" }, redirect: "manual", cache: "no-store",
  });
  if (download.status >= 300 && download.status < 400) {
    const location = download.headers.get("location");
    let target: URL;
    try { target = new URL(location ?? ""); }
    catch { return error(request, 502, "GitHub returned an invalid download link."); }
    if (target.protocol !== "https:") return error(request, 502, "GitHub returned an invalid download link.");
    const response = NextResponse.redirect(target);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  if (!download.ok || !download.body || download.headers.get("content-type")?.includes("json")) {
    return error(request, 502, "GitHub did not return the installer.");
  }
  const length = download.headers.get("content-length");
  if (length && Number(length) !== asset.size) return error(request, 502, "Installer size differs from the release record.");
  return new NextResponse(download.body, { headers: {
    "Content-Type": "application/octet-stream", "Content-Length": String(asset.size),
    "Content-Disposition": `attachment; filename="${asset.name}"`,
    "X-Installer-SHA256": asset.sha256,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
