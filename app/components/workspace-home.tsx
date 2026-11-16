import type { ApplicationCard } from "@/lib/portal";
import { ApplicationCatalog } from "./application-catalog";
import { Icon } from "./symbols";
import type { WorkspaceMember } from "./workspace-shell";

export function WorkspaceHome({ member, applications, oauthReady, downloadReady }: { member: WorkspaceMember; applications: ApplicationCard[]; oauthReady: Record<string, boolean>; downloadReady: boolean }) {
  const available = applications.filter((app) => app.kind === "web" || (app.kind === "download" && downloadReady)).length;
  return <>
    <div className="page-heading"><div><p className="eyebrow">YOUR DAILY STARTING POINT</p><h1>Welcome back, {member.full_name.split(" ")[0]}<span className="heading-period">.</span></h1><p>Your tools, your team, all in one place.</p></div><span className="department-badge"><Icon name="building" size={16} />{member.department || "AI Department"}</span></div>
    <section className="welcome-panel" aria-labelledby="welcome-heading"><div className="welcome-copy"><span className="welcome-label"><Icon name="layers" size={16} />THE AIDECK WORKSPACE</span><h2 id="welcome-heading">Less switching.<br />More getting things done.</h2><p>From your first request to the final signature,<br className="desktop-break" /> your department’s tools start here.</p><a href="#applications-heading" className="welcome-link">Explore your applications<Icon name="arrow" size={17} /></a></div><div className="app-orbit" aria-hidden="true"><div className="orbit-ring" /><div className="orbit-ring inner" /><span className="orbit-center"><Icon name="layers" size={39} /><b>AIDeck</b></span><span className="orbit-app orbit-sign"><Icon name="pen" size={23} /><span>Signora</span></span><span className="orbit-app orbit-ticket"><Icon name="ticket" size={23} /><span>Ticketing</span></span><span className="orbit-app orbit-risk"><Icon name="shield" size={23} /><span>RiskScreen</span></span></div></section>
    <div className="workspace-summary"><span><span className="live-dot" /><strong>{available} application{available === 1 ? "" : "s"}</strong> ready to use</span><span><Icon name="shield" size={16} />Access tailored to your role</span></div>
    <ApplicationCatalog applications={applications} oauthReady={oauthReady} downloadReady={downloadReady} />
    <section className="help-panel"><span className="help-icon"><Icon name="help" size={22} /></span><div><h3>Missing an application?</h3><p>Your applications are based on your assigned access. Contact your portal administrator to get connected.</p></div><span className="help-tag">Here to help</span></section>
  </>;
}

