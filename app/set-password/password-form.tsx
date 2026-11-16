"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function PasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(data: FormData) {
    const password = String(data.get("password") ?? "");
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    if (password !== String(data.get("confirmPassword") ?? "")) { setError("Your passwords don’t match. Please try again."); return; }
    setBusy(true); setError("");
    try {
      const { error } = await supabaseBrowser().auth.updateUser({ password });
      if (error) { setError(error.message); setBusy(false); return; }
      router.replace("/"); router.refresh();
    } catch { setError("Unable to save your password. Check your connection and try again."); setBusy(false); }
  }
  return <form className="stack auth-form" action={save} aria-busy={busy}>
    <label>New password<input type="password" name="password" autoComplete="new-password" placeholder="At least 8 characters" minLength={8} required /></label>
    <label>Confirm password<input type="password" name="confirmPassword" autoComplete="new-password" placeholder="Enter your password again" minLength={8} required /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="button auth-submit" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
  </form>;
}
