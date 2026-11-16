import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdministrator, type Member } from "@/lib/portal";
import { setVisibility, retryProvision, setSiteAdministrator, addUpcomingApplication, updateUpcomingApplication, assignApplication, setOrdinarySignoraRole } from "./actions";
import { Icon, type IconName } from "@/app/components/symbols";
import { adminSection, adminSections, applicationNames, filterAdminMembers, readableLabel } from "@/lib/admin-ui";
import MemberForm from "./member-form";
import SubmitButton from "./submit-button";

type Assignment = { user_id: string; app_key: string; site_role: string | null; can_manage: boolean; visible: boolean; provision_status: string; provision_error: string | null };
type Department = { id: string; name: string };
type Organization = { id: string; name: string };
type Existing = { id: string; email: string; name: string | null; role: string; source: string };
type CatalogEntry = { key: string; name: string; description: string; kind: string; url: string | null; enabled: boolean };

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { member, apps } = await requireAdministrator();
  const message = await searchParams;
  const membersResult = await db().query<Member>(member.is_superadmin
      ? "select * from aideck.members order by created_at desc limit 100"
      : `select distinct m.* from aideck.members m join aideck.assignments a on a.user_id=m.user_id
         where a.app_key=any($1::text[]) order by m.created_at desc limit 100`,
      member.is_superadmin ? [] : [apps]);
  const members = membersResult.rows;
  const [assignmentsResult, departmentsResult, organizationsResult, auditResult] = await Promise.all([
    db().query<Assignment>(
      `select a.user_id,a.app_key,a.can_manage,a.visible,a.provision_status,a.provision_error,
        coalesce(case when a.app_key='signora' then s.role::text
                      when a.app_key='ticketing' then t.role end,a.site_role) as site_role
       from aideck.assignments a
       left join signora.users s on s.id=a.user_id and a.app_key='signora'
       left join gtjbticketing.profiles t on t.id=a.user_id and a.app_key='ticketing'
       where a.user_id=any($1::uuid[]) order by a.app_key`, [members.map((row) => row.user_id)]),
    db().query<Department>("select id,name from gtjbticketing.departments where is_active and not is_system order by name"),
    db().query<Organization>("select id,name from signora.organizations order by name"),
    db().query<{ action: string; created_at: Date; app_key: string | null; outcome: string }>(
      member.is_superadmin
        ? "select action,created_at,app_key,outcome from aideck.audit_events order by id desc limit 20"
        : "select action,created_at,app_key,outcome from aideck.audit_events where app_key=any($1::text[]) order by id desc limit 20",
      member.is_superadmin ? [] : [apps]),
  ]);
  const memberIds = new Set(members.map((row) => row.user_id));
  const assignments = assignmentsResult.rows.filter((row) => memberIds.has(row.user_id) && (member.is_superadmin || apps.includes(row.app_key)));

  let existing: Existing[] = [];
  let catalog: CatalogEntry[] = [];
  if (member.is_superadmin) {
    const [signora, ticketing, applications] = await Promise.all([
      db().query<Existing>(`select s.id,s.email,s.name,s.role::text,'signora'::text as source
        from signora.users s left join aideck.members m on m.user_id=s.id
        where m.user_id is null order by s.created_at desc limit 30`),
      db().query<Existing>(`select t.id,t.email,t.display_name as name,t.role,'ticketing'::text as source
        from gtjbticketing.profiles t left join aideck.members m on m.user_id=t.id
        where m.user_id is null order by t.created_at desc limit 30`),
      db().query<CatalogEntry>("select key,name,description,kind,url,enabled from aideck.applications order by sort_order,name"),
    ]);
    existing = [...signora.rows, ...ticketing.rows];
    catalog = applications.rows;
  }

  const section = adminSection(message.section, member.is_superadmin);
  const query = typeof message.q === "string" ? message.q : "";
  const status = typeof message.status === "string" ? message.status : "all";
  const filteredMembers = filterAdminMembers(members, query, status);
  const selectedMember = section === "members" ? members.find((row) => row.user_id === message.member) : undefined;
  const icons: Record<string, IconName> = { signora: "pen", ticketing: "ticket", riskscreen: "shield", sessiontrack: "clock" };
  const appName = (key: string) => applicationNames[key] ?? key;
  const counts: Record<string, number> = { members: members.length, existing: existing.length, catalog: catalog.length };
  const actions: Record<string, string> = { invite_or_approve: "Member invited or approved", assign_application: "Application assigned", grant_site_admin: "Site administrator granted", revoke_site_admin: "Site administrator revoked", set_site_role: "Application role updated", hide_entry: "Application entry hidden", restore_entry: "Application entry restored" };

  return <div className="admin-content">
    <header className="admin-heading"><div><h1>Administration</h1><p>Manage your people and their application access.</p></div><div className="admin-heading-actions"><span className="admin-scope"><Icon name="shield" size={14} />{member.is_superadmin ? "Super administrator" : "Site administrator"}</span>{section !== "invite" && <Link className="button" href="/admin?section=invite"><Icon name="mail" size={16} />Invite member</Link>}</div></header>
    <div className="admin-workspace">
      <nav className="admin-navigation" aria-label="Administration sections">{adminSections.filter(({ key }) => member.is_superadmin || !["existing", "catalog"].includes(key)).map(({ key, label }) => <Link href={`/admin?section=${key}`} key={key} aria-current={section === key ? "page" : undefined}><span>{label}</span>{counts[key] !== undefined && <span className="admin-count" aria-label={`${counts[key]} loaded`}>{counts[key]}</span>}</Link>)}<p className="admin-navigation-note">{member.is_superadmin ? "Workspace-wide access" : `Managing ${apps.map(appName).join(", ")}`}</p></nav>
      <div className="admin-section">
        {typeof message.notice === "string" && <p className="success admin-feedback" role="status"><Icon name="check" size={17} />{message.notice}</p>}
        {typeof message.error === "string" && <p className="error admin-feedback" role="alert"><Icon name="help" size={17} />{message.error}</p>}

        {section === "invite" && <section aria-labelledby="invite-heading"><div className="admin-section-heading"><div><h2 id="invite-heading">Invite a member</h2><p>Add someone to your workspace and choose their application access.</p></div></div><MemberForm departments={departmentsResult.rows} organizations={organizationsResult.rows} apps={apps} allowClient={member.is_superadmin} /></section>}

        {section === "members" && (selectedMember ? <section aria-labelledby="access-heading">
          <Link className="admin-back" href="/admin?section=members"><Icon name="arrow" size={15} />Back to members</Link>
          <div className="admin-section-heading"><div><h2 id="access-heading">Manage application access</h2><p>{selectedMember.full_name} · {selectedMember.email}</p></div><span className={`admin-badge admin-state-${selectedMember.status}`}>{readableLabel(selectedMember.status)}</span></div>
          <div className="admin-access-list">
            {assignments.filter((assignment) => assignment.user_id === selectedMember.user_id).map((assignment) => <article className="admin-card admin-member-app" key={assignment.app_key}>
              <div className="admin-member-app-heading"><span className="admin-app-icon"><Icon name={icons[assignment.app_key] ?? "layers"} size={21} /></span><div><h3>{appName(assignment.app_key)}</h3><p>{readableLabel(assignment.site_role || "member")} · {assignment.visible ? "Visible in workspace" : "Hidden from workspace"}{assignment.can_manage && " · Site administrator"}</p></div><span className={`admin-badge admin-state-${assignment.provision_status}`}>{readableLabel(assignment.provision_status)}</span></div>
              {assignment.provision_error && <p className="error" role="status">{assignment.provision_error}</p>}
              <div className="admin-access-actions">
                {!(assignment.app_key === "ticketing" && selectedMember.kind === "staff" && assignment.visible) && <form action={setVisibility}><input type="hidden" name="userId" value={selectedMember.user_id} /><input type="hidden" name="app" value={assignment.app_key} /><input type="hidden" name="visible" value={assignment.visible ? "false" : "true"} /><SubmitButton secondary>{assignment.visible ? "Hide entry" : "Restore entry"}</SubmitButton></form>}
                {assignment.app_key === "ticketing" && selectedMember.kind === "staff" && assignment.visible && <span className="admin-automatic"><Icon name="lock" size={14} />Automatically assigned to GT staff</span>}
                {assignment.provision_status !== "ready" && <form action={retryProvision}><input type="hidden" name="userId" value={selectedMember.user_id} /><input type="hidden" name="app" value={assignment.app_key} /><SubmitButton secondary pendingLabel="Retrying…">Retry provisioning</SubmitButton></form>}
                {member.is_superadmin && selectedMember.kind === "staff" && ["signora", "ticketing"].includes(assignment.app_key) && <form action={setSiteAdministrator}><input type="hidden" name="userId" value={selectedMember.user_id} /><input type="hidden" name="app" value={assignment.app_key} /><input type="hidden" name="grant" value={assignment.can_manage ? "false" : "true"} /><SubmitButton secondary>{assignment.can_manage ? "Revoke site admin" : "Make site admin"}</SubmitButton></form>}
                {assignment.app_key === "signora" && !assignment.can_manage && ["junior", "senior"].includes(assignment.site_role ?? "") && <form action={setOrdinarySignoraRole} className="admin-role-form"><input type="hidden" name="userId" value={selectedMember.user_id} /><label><span className="sr-only">Signora role for {selectedMember.full_name}</span><select name="role" defaultValue={assignment.site_role ?? "junior"}><option value="junior">Junior</option><option value="senior">Senior</option></select></label><SubmitButton secondary>Change role</SubmitButton></form>}
              </div>
            </article>)}
            {assignments.every((assignment) => assignment.user_id !== selectedMember.user_id) && <div className="admin-empty"><Icon name="grid" size={25} /><h3>No assigned applications</h3><p>Assign an application below to give this member workspace access.</p></div>}
          </div>
          {apps.filter((app) => ["signora", "ticketing", "riskscreen"].includes(app) && !assignments.some((assignment) => assignment.user_id === selectedMember.user_id && assignment.app_key === app) && (member.is_superadmin || selectedMember.kind === "staff") && (app !== "ticketing" || selectedMember.kind === "staff")).map((app) => <form action={assignApplication} className="admin-card admin-assign-form" key={app}><div className="admin-card-heading"><h3>Assign {appName(app)}</h3><p>Add this application to {selectedMember.full_name}’s workspace.</p></div><input type="hidden" name="userId" value={selectedMember.user_id} /><input type="hidden" name="app" value={app} />{app === "signora" && <div className="admin-form-grid"><label className="admin-field">Organization<select name="organizationId" defaultValue="" required><option value="">Select an organization</option>{organizationsResult.rows.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label><label className="admin-field">Signora role<select name="role" defaultValue="junior"><option value="junior">Junior</option><option value="senior">Senior</option></select></label></div>}<SubmitButton pendingLabel="Assigning…">Assign {appName(app)}</SubmitButton></form>)}
          <p className="admin-context-note"><Icon name="shield" size={17} /><span>Hiding a portal entry does not revoke access to the connected website.</span></p>
        </section> : <section aria-labelledby="members-heading">
          <div className="admin-section-heading"><div><h2 id="members-heading">Workspace members <span className="admin-count">{members.length}</span></h2><p>View profiles, application access and administrator roles.</p></div></div>
          <form method="get" className="admin-toolbar"><input type="hidden" name="section" value="members" /><label className="admin-search"><Icon name="search" size={17} /><span className="sr-only">Search members by name or email</span><input name="q" type="search" defaultValue={query} placeholder="Search name or email…" /></label><label><span className="sr-only">Filter members by status</span><select name="status" defaultValue={["active", "invited", "suspended"].includes(status) ? status : "all"}><option value="all">All statuses</option><option value="active">Active</option><option value="invited">Invited</option><option value="suspended">Suspended</option></select></label><button className="secondary" type="submit">Apply filters</button>{(query || status !== "all") && <Link href="/admin?section=members" className="admin-text-link">Reset</Link>}</form>
          {filteredMembers.length ? <div className="admin-table-scroll" role="region" aria-label="Workspace members" tabIndex={0}><table className="admin-table"><thead><tr><th scope="col">Member</th><th scope="col">Department</th><th scope="col">Status</th><th scope="col">Application access</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{filteredMembers.map((row) => <tr key={row.user_id}><td><div className="admin-person"><span className="avatar" aria-hidden="true">{row.full_name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("") || "M"}</span><div><strong>{row.full_name}</strong><span>{row.email}</span>{row.is_superadmin && <small>Super administrator</small>}</div></div></td><td><span>{row.department || "—"}</span><small className="admin-cell-detail">{row.kind === "staff" ? "GT staff" : "Client"}</small></td><td><span className={`admin-badge admin-state-${row.status}`}>{readableLabel(row.status)}</span></td><td><div className="admin-app-chips">{assignments.filter((assignment) => assignment.user_id === row.user_id).map((assignment) => <span className="admin-app-chip" key={assignment.app_key} title={`${readableLabel(assignment.provision_status)} · ${assignment.visible ? "Visible" : "Hidden"}`}><Icon name={icons[assignment.app_key] ?? "layers"} size={13} />{appName(assignment.app_key)}{(assignment.provision_status !== "ready" || !assignment.visible) && <span className="admin-chip-detail">{assignment.provision_status !== "ready" ? readableLabel(assignment.provision_status) : "Hidden"}</span>}</span>)}{!assignments.some((assignment) => assignment.user_id === row.user_id) && <span className="muted">No applications</span>}</div></td><td><Link className="admin-row-action" aria-label={`Manage access for ${row.full_name}`} href={`/admin?section=members&member=${encodeURIComponent(row.user_id)}`}>Manage access<Icon name="arrow" size={14} /></Link></td></tr>)}</tbody></table></div> : <div className="admin-empty"><Icon name="users" size={27} /><h3>{members.length ? "No matching members" : "No workspace members yet"}</h3><p>{members.length ? "Try a different name, email or status." : "Invite a member to get started."}</p><Link className="button secondary" href={members.length ? "/admin?section=members" : "/admin?section=invite"}>{members.length ? "Reset filters" : "Invite member"}</Link></div>}
          <p className="admin-result-count">Showing {filteredMembers.length} of {members.length} loaded members · Up to the latest 100</p>
          <p className="admin-context-note"><Icon name="shield" size={17} /><span>Application access is managed per member. Hiding an entry only changes what appears in AIDeck.</span></p>
        </section>)}

        {section === "existing" && <section aria-labelledby="existing-heading"><div className="admin-section-heading"><div><h2 id="existing-heading">Existing site users <span className="admin-count">{existing.length}</span></h2><p>Review existing accounts and add them to this workspace.</p></div></div><p className="admin-context-note admin-note-top"><Icon name="shield" size={17} /><span>Existing website accounts and roles are retained. Verify each member’s identity before approval.</span></p>{existing.length ? <div className="admin-table-scroll" role="region" aria-label="Existing site users" tabIndex={0}><table className="admin-table"><thead><tr><th scope="col">Member</th><th scope="col">Existing application</th><th scope="col">Current role</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{existing.map((row) => <tr key={`${row.source}:${row.id}`}><td><div className="admin-person"><span className="avatar" aria-hidden="true">{(row.name || row.email).slice(0, 1).toUpperCase()}</span><div><strong>{row.name || "Name not provided"}</strong><span>{row.email}</span></div></div></td><td><span className="admin-app-chip"><Icon name={icons[row.source] ?? "layers"} size={14} />{appName(row.source)}</span></td><td>{readableLabel(row.role)}</td><td><Link className="admin-row-action" aria-label={`Review and add ${row.name || row.email}`} href={`/admin/existing/${row.source}/${row.id}`}>Review and add<Icon name="arrow" size={14} /></Link></td></tr>)}</tbody></table></div> : <div className="admin-empty"><Icon name="check" size={27} /><h3>No accounts waiting for review</h3><p>Existing site users not yet in your workspace will appear here.</p></div>}<p className="admin-result-count">Up to the latest 30 accounts per application. Ambiguous identities require manual review.</p></section>}

        {section === "catalog" && <section aria-labelledby="catalog-heading"><div className="admin-section-heading"><div><h2 id="catalog-heading">Application catalog <span className="admin-count">{catalog.length}</span></h2><p>Manage the applications available in your workspace.</p></div></div><details className="admin-card admin-catalog-create"><summary><Icon name="grid" size={17} />Add upcoming application<Icon name="chevron" size={14} /></summary><form action={addUpcomingApplication} className="admin-catalog-form"><div className="admin-form-grid"><label className="admin-field">Application key<input name="key" placeholder="new-tool" minLength={3} maxLength={41} required /></label><label className="admin-field">Application name<input name="name" maxLength={80} required /></label><label className="admin-field admin-field-wide">Description<input name="description" /></label><label className="admin-field admin-field-wide">Website URL<input name="url" type="url" placeholder="https://example.com" required /></label></div><SubmitButton>Add upcoming application</SubmitButton></form></details><div className="admin-catalog-list">{catalog.map((entry) => <article className="admin-card admin-catalog-item" key={entry.key}><div className="admin-catalog-heading"><span className="admin-app-icon"><Icon name={icons[entry.key] ?? "layers"} size={23} /></span><div><h3>{entry.name}</h3><p>{entry.description || "Department application"}</p><small>{entry.kind === "web" ? "Web application" : entry.kind === "download" ? "Desktop application" : "Upcoming application"} · {entry.key}</small></div><span className={`admin-badge ${entry.enabled ? "admin-state-ready" : "admin-state-pending"}`}>{entry.enabled ? "Published" : "Unpublished"}</span></div>{entry.kind === "upcoming" && <details className="admin-catalog-edit"><summary>Edit application details<Icon name="chevron" size={13} /></summary><form action={updateUpcomingApplication} className="admin-catalog-form"><input type="hidden" name="key" value={entry.key} /><div className="admin-form-grid"><label className="admin-field admin-field-wide">Name<input name="name" defaultValue={entry.name} maxLength={80} required /></label><label className="admin-field admin-field-wide">Description<input name="description" defaultValue={entry.description} /></label><label className="admin-field admin-field-wide">Website URL<input name="url" type="url" defaultValue={entry.url ?? ""} required /></label></div><SubmitButton>Save changes</SubmitButton></form></details>}</article>)}</div>{catalog.length === 0 && <div className="admin-empty"><Icon name="grid" size={27} /><h3>No applications yet</h3><p>Add an upcoming application to start your catalog.</p></div>}<p className="admin-context-note"><Icon name="help" size={17} /><span>New applications remain unpublished until their login and profile integration is ready.</span></p></section>}

        {section === "activity" && <section aria-labelledby="activity-heading"><div className="admin-section-heading"><div><h2 id="activity-heading">Recent activity</h2><p>Member changes and application access events.</p></div><span className="admin-result-count">Latest 20 events</span></div>{auditResult.rows.length ? <ol className="admin-timeline">{auditResult.rows.map((row, index) => <li key={index}><span className="admin-event-icon"><Icon name={row.outcome === "ok" ? "check" : "help"} size={17} /></span><div><h3>{actions[row.action] ?? readableLabel(row.action)}</h3><p>{row.app_key ? appName(row.app_key) : "Workspace membership"}</p></div><div className="admin-event-meta"><span className={`admin-badge ${row.outcome === "ok" ? "admin-state-ready" : "admin-state-failed"}`}>{row.outcome === "ok" ? "Completed" : readableLabel(row.outcome)}</span><time dateTime={row.created_at.toISOString()}>{new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }).format(row.created_at)} MYT</time></div></li>)}</ol> : <div className="admin-empty"><Icon name="clock" size={27} /><h3>No recent activity</h3><p>Administrative changes will appear here.</p></div>}</section>}
      </div>
    </div>
  </div>;
}
