import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdministrator } from "@/lib/portal";
import MemberForm from "@/app/admin/member-form";
import { Icon } from "@/app/components/symbols";
import { adminExistingUrl, adminMemberFilters, applicationNames, isUuid, readableLabel } from "@/lib/admin-ui";

export const metadata = { title: "Review existing user" };

type SiteUser = { id: string; email: string; name: string | null; role: string; organization_id: string | null };

export default async function ReviewExisting({ params, searchParams }: {
  params: Promise<{ source: string; id: string }>;
  searchParams: Promise<{ error?: string; q?: string; status?: string }>;
}) {
  const { member } = await requireAdministrator();
  const message = await searchParams;
  const filters = adminMemberFilters(message.q, message.status);
  const back = adminExistingUrl(filters.q, filters.status);
  const unavailable = (title: string, description: string, href = back) => <section className="admin-content admin-review-page"><div className="admin-empty"><Icon name="users" size={28} /><h1>{title}</h1><p>{description}</p><Link className="button secondary" href={href}>Return to administration</Link></div></section>;
  if (!member.is_superadmin) return unavailable("Super administrator access required", "Only a super administrator can review existing website accounts.", "/admin?section=members");
  const { source, id } = await params;
  if (source !== "signora" && source !== "ticketing") return unavailable("Unknown application", "Choose an existing user from a supported application.");
  if (!isUuid(id)) return unavailable("Invalid user identifier", "This user link is incomplete or invalid. Choose the account again from the existing users list.");
  const result = source === "signora"
    ? await db().query<SiteUser>(`select id,email,name,role::text,organization_id from signora.users where id=$1`, [id])
    : await db().query<SiteUser>(`select id,email,display_name as name,role,null::text as organization_id from gtjbticketing.profiles where id=$1`, [id]);
  const user = result.rows[0];
  if (!user) return unavailable("User not found", "This account may have been removed. Return to the existing users list to choose another account.");
  const { error } = message;
  const [departments, organizations, ticketingProfile] = await Promise.all([
    db().query<{ id: string; name: string }>("select id,name from gtjbticketing.departments where is_active and not is_system order by name"),
    db().query<{ id: string; name: string }>("select id,name from signora.organizations order by name"),
    db().query<{ department_id: string | null }>("select department_id from gtjbticketing.profiles where id=$1", [id]),
  ]);
  return <div className="admin-content admin-review-page">
    <Link className="admin-back" href={back}><Icon name="arrow" size={15} />Back to existing users</Link>
    <header className="admin-heading"><div><h1>Review existing user</h1></div><span className="admin-scope"><Icon name="shield" size={14} />Super administrator</span></header>
    <div className="admin-review-identity"><span className="admin-app-icon"><Icon name={source === "signora" ? "pen" : "ticket"} size={21} /></span><div><strong>{applicationNames[source]} account</strong><p>{user.email} · {readableLabel(user.role)}</p></div><span className="admin-badge admin-state-pending">Awaiting approval</span></div>
    {typeof error === "string" && <p className="error admin-feedback" role="alert"><Icon name="help" size={17} />{error}</p>}
    <MemberForm departments={departments.rows} organizations={organizations.rows} apps={["signora", "ticketing", "riskscreen"]} allowClient filters={filters} existing={{ ...user, source, department_id: ticketingProfile.rows[0]?.department_id ?? null }} />
  </div>;
}
