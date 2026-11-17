"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { signOutEverywhere } from "@/app/actions";
import { Brand } from "./brand";
import { Icon } from "./symbols";
import { ThemeToggle } from "./theme-toggle";

export type WorkspaceMember = { full_name: string; email: string; department: string; is_superadmin: boolean };

export function WorkspaceShell({ member, canAdmin, children }: { member: WorkspaceMember; canAdmin: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const admin = pathname.startsWith("/admin");
  const qrStudio = pathname.startsWith("/qr-studio");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const initials = member.full_name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <div className="workspace">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="workspace-sidebar" onKeyDown={(event) => {
      if (event.key === "Escape" && menuOpen) {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    }}>
      <div className="sidebar-brand"><Brand /><button ref={menuButton} className="icon-button mobile-menu" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="workspace-navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? "close" : "menu"} /></button></div>
      <div id="workspace-navigation" className={`sidebar-body ${menuOpen ? "is-open" : ""}`}>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <Link href="/" className={`nav-item ${!admin && !qrStudio ? "active" : ""}`} aria-current={!admin && !qrStudio ? "page" : undefined} onClick={() => setMenuOpen(false)}><Icon name="grid" />My applications</Link>
          <Link href="/qr-studio" className={`nav-item ${qrStudio ? "active" : ""}`} aria-current={qrStudio ? "page" : undefined} onClick={() => setMenuOpen(false)}><Icon name="qr" />QR Studio</Link>
          {canAdmin && <Link href="/admin" className={`nav-item ${admin ? "active" : ""}`} aria-current={admin ? "page" : undefined} onClick={() => setMenuOpen(false)}><Icon name="users" />Administration</Link>}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-profile"><span className="avatar">{initials || "AI"}</span><div><strong>{member.full_name}</strong><small>{member.is_superadmin ? "Super administrator" : member.department || "Portal member"}</small></div></div>
          <form action={signOutEverywhere}><button className="sign-out" title="Sign out of all connected sites"><Icon name="logout" size={17} />Sign out of all sites</button></form>
        </div>
      </div>
    </aside>
    <div className="workspace-body"><header className="workspace-topbar"><div className="breadcrumb"><span>Workspace</span><Icon name="chevron" size={13} /><strong>{admin ? "Administration" : qrStudio ? "QR Studio" : "My applications"}</strong></div><div className="topbar-actions"><ThemeToggle /><span className="avatar small" title={member.full_name}>{initials || "AI"}</span></div></header>
      <main id="main-content" className="workspace-main">{children}</main>
    </div>
  </div>;
}

