"use client";
import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Icon } from "@/app/components/symbols";
import { safePortalNext } from "@/lib/oauth-policy";

export default function LoginForm({ inviteError }: { inviteError?: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);
  async function signIn(data: FormData) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const { error } = await supabaseBrowser().auth.signInWithPassword({ email: String(data.get("email") ?? "").trim(), password: String(data.get("password") ?? "") });
      if (error) { setError("We couldn't sign you in. Check your email and password, then try again."); setBusy(false); passwordInput.current?.focus(); return; }
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.replace(safePortalNext(next));
    } catch { setError("Unable to sign in. Check your connection and try again."); setBusy(false); passwordInput.current?.focus(); }
  }
  return <form className="stack auth-form" onSubmit={(event) => { event.preventDefault(); void signIn(new FormData(event.currentTarget)); }} onChange={() => setError("")} aria-busy={busy} aria-describedby={inviteError ? "invitation-error" : error ? "sign-in-error" : undefined}>
    {inviteError && <p id="invitation-error" className="error auth-error" role="alert">{inviteError}</p>}
    <div className="auth-field">
      <label htmlFor="email">Email address</label>
      <span className="input-with-icon"><Icon name="mail" size={18} /><input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required aria-invalid={error ? true : undefined} aria-describedby={error ? "sign-in-error" : undefined} /></span>
    </div>
    <div className="auth-field">
      <label htmlFor="password">Password</label>
      <span className="input-with-icon"><Icon name="lock" size={18} /><input ref={passwordInput} id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required aria-invalid={error ? true : undefined} aria-describedby={error ? "sign-in-error" : undefined} /><button className="password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-controls="password" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><Icon name="eye" size={18} /></button></span>
    </div>
    {error && <p id="sign-in-error" className="error auth-error" role="alert">{error}</p>}
    <button className="button auth-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in to AIDeck"}<Icon name="arrow" size={18} /></button>
  </form>;
}

