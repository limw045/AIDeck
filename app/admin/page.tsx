import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdministrator, type Member } from "@/lib/portal";
import { inviteMember, setVisibility, retryProvision, setSiteAdministrator, addUpcomingApplication, updateUpcomingApplication, assignApplication, setOrdinarySignoraRole } from "./actions";
import MemberDepartmentFields from "./member-department-fields";

type Assignment = { user_id: string; app_key: string; site_role: string | null; can_manage: boolean; visible: boolean; provision_status: string; provision_error: string | null };
type Department = { id: string; name: string };
type Organization = { id: string; name: string };
type Existing = { id: string; email: string; name: string | null; role: string; source: string };
type CatalogEntry = { key: string; name: string; description: string; kind: string; url: string | null; enabled: boolean };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
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
       left join signora."User" s on s.id=a.user_id and a.app_key='signora'
       left join gtjbticketing.profiles t on t.id=a.user_id and a.app_key='ticketing'
       where a.user_id=any($1::uuid[]) order by a.app_key`, [members.map((row) => row.user_id)]),
    db().query<Department>("select id,name from gtjbticketing.departments where is_active and not is_system order by name"),
    db().query<Organization>("select id,name from signora.\"Organization\" order by name"),
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
        from signora."User" s left join aideck.members m on m.user_id=s.id
        where m.user_id is null order by s."createdAt" desc limit 30`),
      db().query<Existing>(`select t.id,t.email,t.display_name as name,t.role,'ticketing'::text as source
        from gtjbticketing.profiles t left join aideck.members m on m.user_id=t.id
        where m.user_id is null order by t.created_at desc limit 30`),
      db().query<CatalogEntry>("select key,name,description,kind,url,enabled from aideck.applications order by sort_order,name"),
    ]);
    existing = [...signora.rows, ...ticketing.rows];
    catalog = applications.rows;
  }

  return <div className="admin-content">
    <header><div><h1>Administration</h1><p className="muted">{member.is_superadmin ? "Super administrator" : `Site administrator: ${apps.join(", ")}`}</p></div><Link href="/">Back to applications</Link></header>
    {message.notice && <p className="success" role="status">{message.notice}</p>}
    {message.error && <p className="error" role="alert">{message.error}</p>}
    <nav className="admin-shortcuts" aria-label="Administration sections"><a href="#invite-member">Invite member</a><a href="#members">Members</a>{member.is_superadmin && <><a href="#existing-users">Existing users</a><a href="#catalog">Application catalog</a></>}<a href="#activity">Recent activity</a></nav>

    <section className="panel" id="invite-member"><h2>Invite a member</h2>
      <form action={inviteMember} className="stack">
        <label>Email<input type="email" name="email" required /></label>
        <label>Full name<input name="fullName" maxLength={120} required /></label>
        <label>Employee type<select name="employeeType"><option value="full_time">Staff</option><option value="intern">Intern</option><option value="contractor">Contractor</option></select></label>
        <MemberDepartmentFields departments={departmentsResult.rows} allowClient={member.is_superadmin} />
        <fieldset><legend>Application access</legend>
          {apps.filter((app) => app !== "ticketing" || member.is_superadmin).map((app) => <label key={app} style={{ display: "block", fontWeight: 400 }}><input type="checkbox" name="apps" value={app} style={{ width: "auto", marginRight: 8 }} />{app}</label>)}
          <p className="muted">Every GT staff member receives Ticketing automatically. RiskScreen is download only.</p>
        </fieldset>
        {apps.includes("signora") && <><label>Signora Organization<select name="organizationId" defaultValue=""><option value="">Select when inviting to Signora</option>{organizationsResult.rows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label>Signora role<select name="signoraRole"><option value="junior">Junior</option><option value="senior">Senior</option></select></label></>}
        <button>Invite or add member</button>
      </form>
    </section>

    <section className="panel" id="members"><h2>Members and website entries</h2>
      <div style={{ overflowX: "auto" }}><table><thead><tr><th>Member</th><th>Kind</th><th>Status</th><th>Assignments</th></tr></thead><tbody>
        {members.map((row) => <tr key={row.user_id}><td><strong>{row.full_name}</strong><br /><span className="muted">{row.email}</span></td><td>{row.kind}</td><td>{row.status}</td><td>
          {assignments.filter((a) => a.user_id === row.user_id).map((a) => <div key={a.app_key} style={{ marginBottom: 10 }}>
            <strong>{a.app_key}</strong> · {a.site_role || "member"} · {a.provision_status} · {a.visible ? "shown" : "hidden"}{a.can_manage && " · site admin"}
            {a.provision_error && <p className="error">{a.provision_error}</p>}
            <div className="actions">
              <form action={setVisibility}><input type="hidden" name="userId" value={row.user_id} /><input type="hidden" name="app" value={a.app_key} /><input type="hidden" name="visible" value={a.visible ? "false" : "true"} /><button className="secondary">{a.visible ? "Hide entry" : "Restore entry"}</button></form>
              {a.provision_status !== "ready" && <form action={retryProvision}><input type="hidden" name="userId" value={row.user_id} /><input type="hidden" name="app" value={a.app_key} /><button className="secondary">Retry</button></form>}
              {member.is_superadmin && (a.app_key === "signora" || a.app_key === "ticketing") && <form action={setSiteAdministrator}><input type="hidden" name="userId" value={row.user_id} /><input type="hidden" name="app" value={a.app_key} /><input type="hidden" name="grant" value={a.can_manage ? "false" : "true"} /><button className="secondary">{a.can_manage ? "Revoke site admin" : "Make site admin"}</button></form>}
              {a.app_key === "signora" && !a.can_manage && ["junior", "senior"].includes(a.site_role ?? "") && <form action={setOrdinarySignoraRole}>
                <input type="hidden" name="userId" value={row.user_id} />
                <select name="role" defaultValue={a.site_role ?? "junior"} style={{ width: "auto" }}><option value="junior">Junior</option><option value="senior">Senior</option></select>
                <button className="secondary">Change role</button>
              </form>}
            </div>
          </div>)}
          {apps.filter((app) => ["signora", "ticketing", "riskscreen"].includes(app)
            && !assignments.some((a) => a.user_id === row.user_id && a.app_key === app)
            && (member.is_superadmin || row.kind === "staff")
            && (app !== "ticketing" || row.kind === "staff")).map((app) => <form action={assignApplication} key={app} className="actions" style={{ marginBottom: 8 }}>
              <input type="hidden" name="userId" value={row.user_id} /><input type="hidden" name="app" value={app} />
              {app === "signora" && <><select name="organizationId" defaultValue="" style={{ width: "auto" }}><option value="">Organization</option>{organizationsResult.rows.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select>
                <select name="role" defaultValue="junior" style={{ width: "auto" }}><option value="junior">Junior</option><option value="senior">Senior</option></select></>}
              <button className="secondary">Assign {app}</button>
            </form>)}
        </td></tr>)}
      </tbody></table></div>
    </section>

    {member.is_superadmin && <><section className="panel" id="existing-users"><h2>Existing site users</h2>
      <p>These {existing.length} site users are not yet portal members. Select <strong>Review and add</strong>, complete their central details, and approve them. Their site role will be retained.</p>
      <p className="muted">An exact Supabase Auth ID is required. Ambiguous identities need manual review.</p>
      <div style={{ overflowX: "auto" }}><table><thead><tr><th>Site</th><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead><tbody>
        {existing.map((row) => <tr key={`${row.source}:${row.id}`}><td>{row.source}</td><td>{row.name}</td><td>{row.email}</td><td>{row.role}</td><td><Link href={`/admin/existing/${row.source}/${row.id}`}>Review and add</Link></td></tr>)}
      </tbody></table></div>
    </section>
    <section className="panel" id="catalog"><h2>Application catalog</h2><p>New applications stay unpublished until their login and profile integration is ready.</p>
      <form action={addUpcomingApplication} className="stack"><label>Key<input name="key" placeholder="new-tool" required /></label><label>Name<input name="name" required /></label><label>Description<input name="description" /></label><label>URL<input name="url" type="url" placeholder="https://example.com" required /></label><button>Add Upcoming entry</button></form>
      <div className="stack" style={{ marginTop: 24 }}>{catalog.map((entry) => <div key={entry.key}>
        <strong>{entry.name}</strong> · {entry.key} · {entry.kind} · {entry.enabled ? "published" : "unpublished"}
        {entry.kind === "upcoming" && <form action={updateUpcomingApplication} className="stack" style={{ marginTop: 8 }}>
          <input type="hidden" name="key" value={entry.key} />
          <label>Name<input name="name" defaultValue={entry.name} maxLength={80} required /></label>
          <label>Description<input name="description" defaultValue={entry.description} /></label>
          <label>URL<input name="url" type="url" defaultValue={entry.url ?? ""} required /></label>
          <button className="secondary">Save {entry.key}</button>
        </form>}
      </div>)}</div>
    </section></>}
    <section className="panel" id="activity"><h2>Recent activity</h2><ul>{auditResult.rows.map((row, index) => <li key={index}>{row.created_at.toLocaleString()} · {row.action} · {row.app_key ?? "member"} · {row.outcome}</li>)}</ul></section>
  </div>;
}
