"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { ApplicationCard } from "@/lib/portal";
import { launchApplication } from "@/app/actions";
import { Icon, type IconName } from "./symbols";

const appIcons: Record<string, IconName> = {
  signora: "pen", ticketing: "ticket", riskscreen: "shield", sessiontrack: "clock", qrstudio: "qr",
};
function LaunchButton({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return <button className="button app-launch" disabled={pending} aria-label={`Open ${name}`}>{pending ? "Opening…" : "Open application"}<Icon name="external" size={16} /></button>;
}
export function ApplicationCatalog({ applications, oauthReady, downloadReady }: { applications: ApplicationCard[]; oauthReady: Record<string, boolean>; downloadReady: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const displayKind = (app: ApplicationCard) => app.kind === "download" && !downloadReady ? "upcoming" : app.kind;
  const filters = [{ key: "all", label: "All applications" }, { key: "web", label: "Web apps" }, { key: "download", label: "Desktop apps" }, { key: "upcoming", label: "Upcoming" }];
  const visible = applications.filter((app) => (filter === "all" || displayKind(app) === filter) && `${app.name} ${app.description}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="catalog-section" aria-labelledby="applications-heading">
    <div className="section-heading"><div><h1 id="applications-heading">My applications <span className="count-badge">{applications.length}</span></h1><p className="section-description">Your tools, together in one workspace.</p></div><label className="search-field"><Icon name="search" size={18} /><span className="sr-only">Search applications</span><input type="search" placeholder="Search applications…" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
    <div className="catalog-tabs" role="group" aria-label="Filter applications">{filters.map(({ key, label }) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span>{key === "all" ? applications.length : applications.filter((app) => displayKind(app) === key).length}</span></button>)}</div>
    <div className="app-grid">{visible.map((app) => {
      const kind = displayKind(app);
      return <article className={`app-card ${kind === "upcoming" ? "app-card-upcoming" : ""}`} key={app.key}>
        <div className="app-card-top"><span className={`app-icon app-icon-${app.key}`}><Icon name={appIcons[app.key] ?? "layers"} size={26} /></span><span className={`status-badge ${kind !== "web" ? "status-upcoming" : "status-ready"}`}><span />{kind === "upcoming" ? "Coming soon" : kind === "download" ? "Desktop app" : "Available"}</span></div>
        <div className="app-card-copy"><h2>{app.name}</h2>{app.description && <p className="app-description">{app.description}</p>}</div>
        {kind !== "upcoming" && <div className="app-card-bottom">{kind === "download" ? <><p className="app-meta"><Icon name="download" size={14} />Windows desktop application</p><a className="button secondary app-launch" href="/api/riskscreen/download">Download installer<Icon name="download" size={16} /></a></> : app.key === "qrstudio" ? <><p className="app-meta"><Icon name="grid" size={14} />Included in your workspace</p><a className="button app-launch" href="/qr-studio" aria-label="Open QR Studio">Open application<Icon name="arrow" size={16} /></a></> : <><p className="app-meta"><Icon name={oauthReady[app.key] ? "lock" : "external"} size={14} />{oauthReady[app.key] ? "Connected to your AIDeck account" : "Separate sign-in required"}</p><form action={launchApplication}><input type="hidden" name="app" value={app.key} /><LaunchButton name={app.name} /></form></>}</div>}
      </article>;
    })}</div>
    {visible.length === 0 && <div className="empty-state" role="status"><Icon name="search" size={28} /><h2>{applications.length === 0 ? "No applications available" : "No applications found"}</h2><p>{applications.length === 0 ? "Ask your portal administrator to assign application access to your account." : "Try another search or choose a different category."}</p>{applications.length > 0 && <button className="button secondary" onClick={() => { setQuery(""); setFilter("all"); }}>Reset filters</button>}</div>}
    <p className="catalog-count" role="status" aria-live="polite">Showing {visible.length} of {applications.length} applications</p>
  </section>;
}

