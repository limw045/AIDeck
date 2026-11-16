import PasswordForm from "./password-form";
import { AuthShell } from "@/app/components/auth-shell";

export const metadata = { title: "Complete your invitation" };
export default function SetPassword() {
  return <AuthShell><h1>Set password</h1><PasswordForm /></AuthShell>;
}

