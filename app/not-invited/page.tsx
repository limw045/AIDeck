import { signOutEverywhere } from "@/app/actions";
import { AuthShell } from "@/app/components/auth-shell";
import { Icon } from "@/app/components/symbols";

export const metadata = {
  title: "Access unavailable",
  description: "Contact your administrator to activate or restore AIDeck access.",
};

export default function NotInvited() {
  return <AuthShell><Icon name="lock" size={24} className="auth-status-icon" /><h1>Access unavailable</h1><p className="auth-description">Contact your administrator to activate or restore your account. After access is restored, sign out and sign in again.</p><form action={signOutEverywhere}><button className="button auth-submit">Sign out and sign in again<Icon name="logout" size={18} /></button></form></AuthShell>;
}

