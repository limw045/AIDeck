import { signOutEverywhere } from "@/app/actions";
import { AuthShell } from "@/app/components/auth-shell";
import { Icon } from "@/app/components/symbols";

export default function NotInvited() {
  return <AuthShell><h1>Access unavailable</h1><p className="auth-description">Contact your administrator to activate or restore your account, then sign in again.</p><form action={signOutEverywhere}><button className="button auth-submit">Sign out<Icon name="logout" size={18} /></button></form></AuthShell>;
}

