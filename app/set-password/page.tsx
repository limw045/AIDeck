import PasswordForm from "./password-form";
import { AuthShell } from "@/app/components/auth-shell";
import { Icon } from "@/app/components/symbols";

export const metadata = { title: "Complete your invitation" };
export default function SetPassword() {
  return <AuthShell><div className="auth-welcome-icon"><Icon name="lock" size={25} /></div><p className="eyebrow">LET’S GET YOU STARTED</p><h1>Make yourself at home.</h1><p className="auth-description">Complete your invitation by setting a password for your AIDeck account.</p><PasswordForm /></AuthShell>;
}

