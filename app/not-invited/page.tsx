import { signOutEverywhere } from "@/app/actions";
import { AuthShell } from "@/app/components/auth-shell";
import { Icon } from "@/app/components/symbols";

export default function NotInvited() {
  return <AuthShell><div className="auth-welcome-icon"><Icon name="shield" size={25} /></div><p className="eyebrow">PORTAL ACCESS</p><h1>You’re almost there.</h1><p className="auth-description">Your account is signed in, but your AIDeck access hasn’t been activated yet.</p><div className="auth-note"><Icon name="help" size={20} /><p>Contact your portal administrator to approve your account. Once approved, sign in again to open your workspace.</p></div><form action={signOutEverywhere}><button className="button auth-submit">Sign out<Icon name="logout" size={18} /></button></form></AuthShell>;
}

