import LoginForm from "./login-form";
import { AuthShell } from "@/app/components/auth-shell";
import { Icon } from "@/app/components/symbols";

export const metadata = { title: "Sign in" };
export default function Login() {
  return <AuthShell><h1>Sign in</h1><LoginForm /><div className="auth-note"><Icon name="help" size={18} /><p>Need an account? Contact your administrator.</p></div></AuthShell>;
}

