import LoginForm from "./login-form";
import { AuthShell } from "@/app/components/auth-shell";
import { Icon } from "@/app/components/symbols";

export const metadata = { title: "Sign in", description: "Sign in to access your organization's AIDeck applications." };

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const { error } = await searchParams;
  const inviteError = error === "missing-code"
    ? "This invitation link is incomplete. Ask your administrator to send a new invitation."
    : error === "invalid-invite"
      ? "This invitation link is no longer valid. Ask your administrator to send a new invitation."
      : undefined;

  return <AuthShell><h1>Sign in</h1><p className="auth-description">Sign in to continue to the applications assigned to your account.</p><LoginForm inviteError={inviteError} /><div className="auth-note"><Icon name="help" size={18} /><p>Need an account? Contact your administrator.</p></div></AuthShell>;
}

