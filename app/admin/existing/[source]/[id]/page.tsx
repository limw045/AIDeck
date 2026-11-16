import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdministrator } from "@/lib/portal";
import MemberForm from "@/app/admin/member-form";
import { Icon } from "@/app/components/symbols";
import { applicationNames, readableLabel } from "@/lib/admin-ui";

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
    ? await db().query<SiteUser>(`select id,email,name,role::text,organization_id from signora.users where id=$1`, [id])
    : await db().query<SiteUser>(`select id,email,display_name as name,role,null::text as organization_id from gtjbticketing.profiles where id=$1`, [id]);
  const user = result.rows[0];
  if (!user) return <div className="panel">User not found.</div>;
  const { error } = await searchParams;
  const [departments, organizations, ticketingProfile] = await Promise.all([
    db().query<{ id: string; name: string }>("select id,name from gtjbticketing.departments where is_active and not is_system order by name"),
    db().query<{ id: string; name: string }>("select id,name from signora.organizations order by name"),
    db().query<{ department_id: string | null }>("select department_id from gtjbticketing.profiles where id=$1", [id]),
  ]);
  return <div className="admin-content admin-review-page">
    <Link className="admin-back" href="/admin?section=existing"><Icon name="arrow" size={15} />Back to existing users</Link>
    <header className="admin-heading"><div><h1>Review existing user</h1></div><span className="admin-scope"><Icon name="shield" size={14} />Super administrator</span></header>
    <div className="admin-review-identity"><span className="admin-app-icon"><Icon name={source === "signora" ? "pen" : "ticket"} size={21} /></span><div><strong>{applicationNames[source]} account</strong><p>{user.email} · {readableLabel(user.role)}</p></div><span className="admin-badge admin-state-pending">Awaiting approval</span></div>
    {typeof error === "string" && <p className="error admin-feedback" role="alert"><Icon name="help" size={17} />{error}</p>}
    <MemberForm departments={departments.rows} organizations={organizations.rows} apps={["signora", "ticketing", "riskscreen"]} allowClient existing={{ ...user, source, department_id: ticketingProfile.rows[0]?.department_id ?? null }} />
  </div>;
}
