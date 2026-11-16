"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/portal";
import { supabaseServer } from "@/lib/supabase/server";

export async function signOutEverywhere() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}

export async function launchApplication(form: FormData) {
  const member = await requireMember();
  const app = String(form.get("app") ?? "");
  if (app !== "signora" && app !== "ticketing") throw new Error("This application is not connected yet.");
  const grant = await db().query(
    `select 1 from aideck.assignments g join aideck.applications a on a.key=g.app_key
     where g.user_id=$1 and g.app_key=$2 and a.enabled
     and g.visible and g.provision_status='ready'`, [member.user_id, app],
  );
  if (!grant.rowCount) throw new Error("This application is not assigned to you.");
  const origin = app === "signora" ? process.env.SIGNORA_URL : process.env.TICKETING_URL;
  if (!origin) throw new Error("The application URL is not configured.");
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.protocol !== "https:" && parsedOrigin.hostname !== "localhost") throw new Error("The application URL must use HTTPS.");
  const oauthReady = app === "signora"
    ? process.env.SIGNORA_OAUTH_READY === "true"
    : process.env.TICKETING_OAUTH_READY === "true";
  redirect(oauthReady ? new URL("/auth/portal/start", parsedOrigin).toString() : parsedOrigin.toString());
}
