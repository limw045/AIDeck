import Link from "next/link";
import { AuthShell } from "@/app/components/auth-shell";
import { Icon } from "@/app/components/symbols";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return <AuthShell><Icon name="search" className="auth-status-icon" /><h1>Page not found</h1><p className="auth-description">This page may have moved, or the link may be incorrect. Return to your workspace to continue.</p><Link className="button auth-submit" href="/">Return to AIDeck<Icon name="arrow" size={18} /></Link></AuthShell>;
}
