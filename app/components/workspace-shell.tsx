"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOutEverywhere } from "@/app/actions";
import { Brand } from "./brand";
import { Icon } from "./symbols";
import { ThemeToggle } from "./theme-toggle";

export type WorkspaceMember = { full_name: string; email: string; department: string; is_superadmin: boolean };

export function WorkspaceShell({ member, canAdmin, children }: { member: WorkspaceMember; canAdmin: boolean; children: ReactNode }) {
  const admin = usePathname().startsWith("/admin");
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = member.full_name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <div className="workspace">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="workspace-sidebar">
      <div className="sidebar-brand"><Brand /><button className="icon-button mobile-menu" type="button" aria-label="Toggle navigation" aria-expanded={menuOpen} aria-controls="workspace-navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? "close" : "menu"} /></button></div>
      <div id="workspace-navigation" className={`sidebar-body ${menuOpen ? "is-open" : ""}`}>
        <div className="workspace-label"><span className="department-mark"><Icon name="building" size={18} /></span><div><strong>AI Department</strong><small>Your connected workspace</small></div></div>
        <nav className="sidebar-nav" aria-label="Main navigation"><p className="nav-label">WORKSPACE</p>
          <Link href="/" className={`nav-item ${!admin ? "active" : ""}`} aria-current={!admin ? "page" : undefined} onClick={() => setMenuOpen(false)}><Icon name="grid" />My applications</Link>
          {canAdmin && <><p className="nav-label admin-label">MANAGEMENT</p><Link href="/admin" className={`nav-item ${admin ? "active" : ""}`} aria-current={admin ? "page" : undefined} onClick={() => setMenuOpen(false)}><Icon name="users" />Administration</Link></>}
        </nav>
        <div className="sidebar-bottom"><div className="sidebar-note"><Icon name="layers" size={22} /><strong>One place. Your tools.</strong><p>Your department’s applications, together in AIDeck.</p></div>
          <div className="sidebar-profile"><span className="avatar">{initials || "AI"}</span><div><strong>{member.full_name}</strong><small>{member.is_superadmin ? "Super administrator" : member.department || "Portal member"}</small></div></div>
          <form action={signOutEverywhere}><button className="sign-out" title="Sign out of all connected sites"><Icon name="logout" size={17} />Sign out of all sites</button></form>
        </div>
      </div>
    </aside>
    <div className="workspace-body"><header className="workspace-topbar"><div className="breadcrumb"><span>Workspace</span><Icon name="chevron" size={13} /><strong>{admin ? "Administration" : "My applications"}</strong></div><div className="topbar-actions"><span className="internal-label"><Icon name="lock" size={13} />Member access</span><ThemeToggle /><span className="avatar small" title={member.full_name}>{initials || "AI"}</span></div></header>
      <main id="main-content" className="workspace-main">{children}</main>
      <footer className="workspace-footer"><span>AIDeck <span className="footer-dot">·</span> Grant Thornton AI Department</span><span>Built for your working day.</span></footer>
    </div>
  </div>;
}

