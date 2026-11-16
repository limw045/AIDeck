import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { supabaseServer } from "@/lib/supabase/server";
import type { OAuthApplication } from "@/lib/oauth-policy";

export async function oauthApplications(): Promise<OAuthApplication[]> {
  const result = await db().query<OAuthApplication>(
    `select c.app_key as "appKey", c.client_id as "clientId", c.redirect_uri as "redirectUri", c.allowed_scopes as "allowedScopes"
     from aideck.oauth_clients c join aideck.applications a on a.key=c.app_key
     where c.enabled and a.enabled`,
  );
  const ready: Record<string, boolean> = {
    signora: process.env.SIGNORA_OAUTH_READY === "true",
    ticketing: process.env.TICKETING_OAUTH_READY === "true",
  };
  return result.rows.filter((app) => ready[app.appKey]);
}

export type Member = {
  user_id: string;
  email: string;
  full_name: string;
  department: string;
  employee_type: "full_time" | "intern" | "contractor";
  ticketing_department_id: string | null;
  kind: "staff" | "client";
  status: "invited" | "active" | "suspended";
  is_superadmin: boolean;
};

export async function currentMember(): Promise<Member | null> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const result = await db().query<Member>("select * from aideck.members where user_id = $1", [user.id]);
  const member = result.rows[0] ?? null;
  if (!member) return null;
  if (member.status === "invited") {
    await db().query("update aideck.members set status = 'active', updated_at = now() where user_id = $1", [user.id]);
    member.status = "active";
  }
  return member.status === "active" ? member : null;
}

export async function requireMember(): Promise<Member> {
  const member = await currentMember();
  if (!member) redirect("/not-invited");
  return member;
}

export async function managedApps(member: Member): Promise<string[]> {
  if (member.is_superadmin) return ["signora", "ticketing", "riskscreen"];
  const rows = await db().query<{ app_key: string }>(
    "select app_key from aideck.assignments where user_id = $1 and can_manage and visible and provision_status = 'ready'",
    [member.user_id],
  );
  return rows.rows.map((row) => row.app_key);
}

export async function requireAdministrator(): Promise<{ member: Member; apps: string[] }> {
  const member = await requireMember();
  const apps = await managedApps(member);
  if (!member.is_superadmin && apps.length === 0) redirect("/");
  return { member, apps };
}

export type ApplicationCard = {
  key: string;
  name: string;
  description: string;
  kind: "web" | "download" | "upcoming";
  url: string | null;
};

export async function visibleApplications(member: Member): Promise<ApplicationCard[]> {
  const rows = await db().query<ApplicationCard>(
    `select a.key, a.name, a.description, a.kind, a.url
     from aideck.applications a
     left join aideck.assignments g on g.app_key = a.key and g.user_id = $1
     where a.enabled and (a.kind = 'upcoming' or
       (g.visible and g.provision_status = 'ready'))
     order by a.sort_order, a.name`,
    [member.user_id],
  );
  return [...rows.rows, {
    key: "qrstudio",
    name: "QR Studio",
    description: "Generate QR codes. Export PNG or SVG.",
    kind: "web",
    url: "/qr-studio",
  }];
}
