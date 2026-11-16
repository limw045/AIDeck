"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

async function decide(form: FormData, allow: boolean) {
  const authorizationId = String(form.get("authorizationId") ?? "");
  if (!authorizationId) throw new Error("Missing authorization request.");
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const result = allow
    ? await supabase.auth.oauth.approveAuthorization(authorizationId)
    : await supabase.auth.oauth.denyAuthorization(authorizationId);
  if (result.error || !result.data?.redirect_url) throw new Error("Authorization request expired. Return to the website and retry.");
  redirect(result.data.redirect_url);
}

export async function approve(form: FormData) { await decide(form, true); }
export async function deny(form: FormData) { await decide(form, false); }
