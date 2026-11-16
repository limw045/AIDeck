"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Icon } from "@/app/components/symbols";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function signIn(data: FormData) {
    setBusy(true); setError("");
    try {
      const { error } = await supabaseBrowser().auth.signInWithPassword({ email: String(data.get("email") ?? "").trim(), password: String(data.get("password") ?? "") });
      if (error) { setError(error.message); setBusy(false); return; }
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch { setError("Unable to sign in. Check your connection and try again."); setBusy(false); }
  }
  return <form className="stack auth-form" action={signIn} aria-busy={busy}>
    <label>Email address<span className="input-with-icon"><Icon name="mail" size={18} /><input name="email" type="email" autoComplete="email" placeholder="you@company.com" required /></span></label>
    <label>Password<span className="input-with-icon"><Icon name="lock" size={18} /><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required /><button className="password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><Icon name="eye" size={18} /></button></span></label>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="button auth-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in to AIDeck"}<Icon name="arrow" size={18} /></button>
  </form>;
}

