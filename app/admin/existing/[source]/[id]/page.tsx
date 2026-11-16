import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdministrator } from "@/lib/portal";
import { approveExisting } from "@/app/admin/actions";
import MemberDepartmentFields from "@/app/admin/member-department-fields";

type SiteUser = { id: string; email: string; name: string | null; role: string; organization_id: string | null };

export default async function ReviewExisting({ params, searchParams }: {
  params: Promise<{ source: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { member } = await requireAdministrator();
  if (!member.is_superadmin) return <div className="panel">Super administrator access required.</div>;
  const { source, id } = await params;
  if (source !== "signora" && source !== "ticketing") return <div className="panel">Unknown source.</div>;
  const result = source === "signora"
    ? await db().query<SiteUser>(`select id,email,name,role::text,"organizationId" as organization_id from signora."User" where id=$1`, [id])
    : await db().query<SiteUser>(`select id,email,display_name as name,role,null::text as organization_id from gtjbticketing.profiles where id=$1`, [id]);
  const user = result.rows[0];
  if (!user) return <div className="panel">User not found.</div>;
  const { error } = await searchParams;
  const [departments, organizations, ticketingProfile] = await Promise.all([
    db().query<{ id: string; name: string }>("select id,name from gtjbticketing.departments where is_active and not is_system order by name"),
    db().query<{ id: string; name: string }>("select id,name from signora.\"Organization\" order by name"),
    db().query<{ department_id: string | null }>("select department_id from gtjbticketing.profiles where id=$1", [id]),
  ]);
  return <div className="admin-content"><header><h1>Approve existing user</h1><Link href="/admin">Back to administration</Link></header>
    <div className="panel"><p><strong>{source}</strong> · {user.email} · current site role: {user.role}</p>
      <p>Complete the central details and choose the applications to show in this member’s portal. Existing site accounts and roles are retained.</p>
      <p className="muted">GT staff select one department, which is also used for Ticketing. Clients enter their department separately and choose a Ticketing department only if assigned Ticketing.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <form action={approveExisting} className="stack">
        <input type="hidden" name="userId" value={user.id} /><input type="hidden" name="source" value={source} />
        <input type="hidden" name="email" value={user.email} />
        <label>Full name<input name="fullName" defaultValue={user.name ?? ""} required /></label>
        <label>Employee type<select name="employeeType"><option value="full_time">Staff</option><option value="intern">Intern</option><option value="contractor">Contractor</option></select></label>
        <MemberDepartmentFields departments={departments.rows} allowClient defaultTicketingDepartmentId={ticketingProfile.rows[0]?.department_id ?? ""} />
        <fieldset><legend>Portal application access</legend>
          <label style={{ display: "block", fontWeight: 400 }}><input type="checkbox" name="apps" value="signora" defaultChecked={source === "signora"} style={{ width: "auto", marginRight: 8 }} />Signora</label>
          <label style={{ display: "block", fontWeight: 400 }}><input type="checkbox" name="apps" value="ticketing" defaultChecked={source === "ticketing"} style={{ width: "auto", marginRight: 8 }} />GT AI Ticketing</label>
          <label style={{ display: "block", fontWeight: 400 }}><input type="checkbox" name="apps" value="riskscreen" style={{ width: "auto", marginRight: 8 }} />RiskScreen installer</label>
          <p className="muted">Session Track remains Upcoming. GT staff receive Ticketing even if its box is clear.</p>
        </fieldset>
        {source === "signora" ? <>
          <label>Signora Organization<select name="organizationId" defaultValue={user.organization_id ?? ""}>{organizations.rows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label>Current Signora role<input name="signoraRole" value={user.role} readOnly /></label>
        </> : <>
          <label>Signora Organization<select name="organizationId" defaultValue=""><option value="">Select if assigning Signora</option>{organizations.rows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label>Signora role<select name="signoraRole"><option value="junior">Junior</option><option value="senior">Senior</option></select></label>
        </>}
        <button>Approve for portal</button>
      </form>
    </div>
  </div>;
}
