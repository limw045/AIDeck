import type { ReactNode } from "react";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";

export function AuthShell({ children }: { children: ReactNode }) {
  return <main className="auth-page"><div className="auth-layout"><div className="auth-main"><header className="auth-header"><Brand /><ThemeToggle /></header><div className="auth-content">{children}</div></div></div></main>;
}

