import LoginForm from "./login-form";
import { AuthShell } from "@/app/components/auth-shell";
import { Icon } from "@/app/components/symbols";

export const metadata = { title: "Sign in" };
export default function Login() {
  return <AuthShell><div className="auth-welcome-icon"><Icon name="layers" size={25} /></div><p className="eyebrow">WELCOME TO AIDECK</p><h1>Your workspace awaits.</h1><p className="auth-description">Sign in to access your department’s applications.</p><LoginForm /><div className="auth-note"><Icon name="help" size={18} /><p>New to AIDeck? Ask your portal administrator for an invitation, or use your existing account.</p></div></AuthShell>;
}

