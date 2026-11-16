import type { ReactNode } from "react";
import { Brand } from "./brand";
import { Icon } from "./symbols";
import { ThemeToggle } from "./theme-toggle";

export function AuthShell({ children }: { children: ReactNode }) {
  return <main className="auth-page"><div className="auth-layout"><div className="auth-main"><header className="auth-header"><Brand /><ThemeToggle /></header><div className="auth-content">{children}</div><footer className="auth-footer"><Icon name="shield" size={14} />Grant Thornton AI Department</footer></div><aside className="auth-artwork"><span className="auth-artwork-label"><Icon name="layers" size={18} />YOUR CONNECTED WORKSPACE</span><div className="auth-app-stack" aria-hidden="true"><div className="auth-stack-card"><span className="app-icon"><Icon name="pen" size={26} /></span><div><strong>Signora</strong><span>Documents, signed.</span></div><Icon name="check" size={18} /></div><div className="auth-stack-card"><span className="app-icon"><Icon name="ticket" size={26} /></span><div><strong>GT AI Ticketing</strong><span>Support, simplified.</span></div><Icon name="check" size={18} /></div><div className="auth-stack-card"><span className="app-icon"><Icon name="shield" size={26} /></span><div><strong>RiskScreen</strong><span>Screening, connected.</span></div><Icon name="check" size={18} /></div></div><div className="auth-artwork-copy"><h2>A better place<br />to start your day.</h2><p>Your department’s applications,<br />together in one familiar workspace.</p></div><div className="auth-artwork-footer"><span className="brand-mark"><Icon name="layers" size={22} /></span><span>One workspace. More possibilities.</span></div></aside></div></main>;
}

