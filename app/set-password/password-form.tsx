"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Icon } from "@/app/components/symbols";

export default function PasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<"password" | "confirmPassword" | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmationInput = useRef<HTMLInputElement>(null);
  async function save(data: FormData) {
    if (busy) return;
    const password = String(data.get("password") ?? "");
    if (password.length < 8) { setError("Use at least 8 characters."); setErrorField("password"); passwordInput.current?.focus(); return; }
    if (password !== String(data.get("confirmPassword") ?? "")) { setError("Your passwords don’t match. Please try again."); setErrorField("confirmPassword"); confirmationInput.current?.focus(); return; }
    setBusy(true); setError(""); setErrorField(null);
    try {
      const { error } = await supabaseBrowser().auth.updateUser({ password });
      if (error) { setError(error.message); setErrorField("password"); setBusy(false); passwordInput.current?.focus(); return; }
      router.replace("/"); router.refresh();
    } catch { setError("Unable to save your password. Check your connection and try again."); setErrorField(null); setBusy(false); }
  }
  return <form className="stack auth-form" onSubmit={(event) => { event.preventDefault(); void save(new FormData(event.currentTarget)); }} onChange={() => { setError(""); setErrorField(null); }} aria-busy={busy}>
    <div className="auth-field">
      <label htmlFor="password">New password</label>
      <span className="input-with-icon"><Icon name="lock" size={18} /><input ref={passwordInput} id="password" type={showPassword ? "text" : "password"} name="password" autoComplete="new-password" placeholder="At least 8 characters" minLength={8} required aria-invalid={errorField === "password" ? true : undefined} aria-describedby={`password-hint${errorField === "password" ? " password-error" : ""}`} /><button className="password-toggle" type="button" aria-label={showPassword ? "Hide new password" : "Show new password"} aria-controls="password" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><Icon name="eye" size={18} /></button></span>
      <span id="password-hint" className="field-hint">At least 8 characters.</span>
      {error && errorField === "password" && <p id="password-error" className="error auth-error" role="alert">{error}</p>}
    </div>
    <div className="auth-field">
      <label htmlFor="confirmPassword">Confirm password</label>
      <span className="input-with-icon"><Icon name="lock" size={18} /><input ref={confirmationInput} id="confirmPassword" type={showConfirmation ? "text" : "password"} name="confirmPassword" autoComplete="new-password" placeholder="Enter your password again" minLength={8} required aria-invalid={errorField === "confirmPassword" ? true : undefined} aria-describedby={`confirmation-hint${errorField === "confirmPassword" ? " confirmation-error" : ""}`} /><button className="password-toggle" type="button" aria-label={showConfirmation ? "Hide confirmation password" : "Show confirmation password"} aria-controls="confirmPassword" aria-pressed={showConfirmation} onClick={() => setShowConfirmation(!showConfirmation)}><Icon name="eye" size={18} /></button></span>
      <span id="confirmation-hint" className="field-hint">Re-enter your new password.</span>
      {error && errorField === "confirmPassword" && <p id="confirmation-error" className="error auth-error" role="alert">{error}</p>}
    </div>
    {error && errorField === null && <p className="error auth-error" role="alert">{error}</p>}
    <button className="button auth-submit" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
  </form>;
}
