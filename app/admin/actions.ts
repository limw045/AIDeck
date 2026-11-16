"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { inviteOrApprove, provisionAssignment, type GrantInput, type MemberInput } from "@/lib/provision";
import { requireAdministrator } from "@/lib/portal";

function value(form: FormData, key: string) { return String(form.get(key) ?? "").trim(); }
function back(message: string, error = false): never {
  redirect(`/admin?${error ? "error" : "notice"}=${encodeURIComponent(message.slice(0, 240))}`);
}
function inputFromForm(form: FormData, kind: "staff" | "client", apps: string[]): MemberInput {
  const selected = form.getAll("apps").map(String);
  const grants: GrantInput[] = [];
  if (selected.includes("signora") && apps.includes("signora")) {
    grants.push({ app: "signora", role: value(form, "signoraRole") || "junior", organizationId: value(form, "organizationId") });
  }
  if (selected.includes("ticketing") && apps.includes("ticketing")) grants.push({ app: "ticketing", role: "employee" });
  if (selected.includes("riskscreen") && apps.includes("riskscreen")) grants.push({ app: "riskscreen" });
  if (selected.some((app) => !apps.includes(app))) throw new Error("An application is outside your administrator scope.");
  return {
    email: value(form, "email"), fullName: value(form, "fullName"),
    department: value(form, "department"),
    employeeType: value(form, "employeeType") as MemberInput["employeeType"],
    ticketingDepartmentId: value(form, "ticketingDepartmentId") || null,
    kind,
    grants,
  };
}

async function completeMemberDepartment(input: MemberInput) {
  const needsTicketingDepartment = input.kind === "staff"
    || input.grants.some((grant) => grant.app === "ticketing");
  if (!needsTicketingDepartment) {
    input.ticketingDepartmentId = null;
    return;
  }
  if (!input.ticketingDepartmentId) {
    throw new Error("Select a department for GT staff or anyone assigned Ticketing.");
  }
  const result = await db().query<{ name: string }>(
    "select name from gtjbticketing.departments where id=$1 and is_active and not is_system",
    [input.ticketingDepartmentId],
  );
  if (!result.rows[0]) throw new Error("Select an active Ticketing department.");
  if (input.kind === "staff") input.department = result.rows[0].name;
}

export async function inviteMember(form: FormData) {
  const { member, apps } = await requireAdministrator();
  let failedApps: string[] = [];
  try {
    const requestedKind = value(form, "kind");
    const kind = member.is_superadmin && requestedKind === "client" ? "client" : "staff";
    const input = inputFromForm(form, kind, apps);
    if (input.grants.some((grant) => grant.app === "signora" && !["junior", "senior"].includes(grant.role ?? ""))) {
      throw new Error("Invitation can grant only ordinary Signora roles. Assign a site administrator after creating the member.");
    }
    if (input.grants.some((grant) => grant.app === "riskscreen") && !member.is_superadmin) throw new Error("Only a Super administrator can assign RiskScreen.");
    await completeMemberDepartment(input);
    const result = await inviteOrApprove(input, member.user_id);
    failedApps = result.results.filter((item) => !item.ok).map((item) => item.app);
  } catch (error) {
    back(error instanceof Error ? error.message : "Invitation failed.", true);
  }
  back(failedApps.length ? `Member saved. Provisioning failed for: ${failedApps.join(", ")}.` : "Member and applications are ready.", failedApps.length > 0);
}

export async function approveExisting(form: FormData) {
  const { member, apps } = await requireAdministrator();
  if (!member.is_superadmin) back("Only a Super administrator can approve existing users.", true);
  const userId = value(form, "userId");
  const source = value(form, "source");
  let failed = false;
  try {
    if (source !== "signora" && source !== "ticketing") throw new Error("Unknown source application.");
    const input = inputFromForm(form, value(form, "kind") === "client" ? "client" : "staff", apps);
    if (source === "signora") {
      const site = await db().query<{ role: string; organization_id: string | null }>(
        `select role::text,"organizationId" as organization_id from signora."User" where id=$1`, [userId],
      );
      if (!site.rows[0]) throw new Error("The Signora user no longer exists.");
      if (input.grants.some((grant) => grant.app === "signora")) {
        input.grants = input.grants.filter((grant) => grant.app !== "signora");
        input.grants.push({ app: "signora", role: site.rows[0].role, organizationId: site.rows[0].organization_id ?? undefined });
      }
    } else {
      const site = await db().query("select 1 from gtjbticketing.profiles where id=$1", [userId]);
      if (!site.rowCount) throw new Error("The Ticketing user no longer exists.");
    }
    await completeMemberDepartment(input);
    const result = await inviteOrApprove(input, member.user_id, userId);
    failed = result.results.some((item) => !item.ok);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approval failed.";
    if (source === "signora" || source === "ticketing") {
      redirect(`/admin/existing/${source}/${encodeURIComponent(userId)}?error=${encodeURIComponent(message.slice(0, 240))}`);
    }
    back(message, true);
  }
  back(failed ? "Existing user approved; review failed assignments." : "Existing user approved.", failed);
}

export async function setVisibility(form: FormData) {
  const { member, apps } = await requireAdministrator();
  const userId = value(form, "userId");
  const app = value(form, "app");
  const visible = value(form, "visible") === "true";
  if (!apps.includes(app)) back("This application is outside your administrator scope.", true);
  const result = await db().query<{ kind: string }>("select kind from aideck.members where user_id=$1", [userId]);
  if (app === "ticketing" && result.rows[0]?.kind === "staff" && !visible) back("GT staff always have a Ticketing entry.", true);
  await db().query("update aideck.assignments set visible=$3,updated_at=now() where user_id=$1 and app_key=$2", [userId, app, visible]);
  await db().query("insert into aideck.audit_events(actor_id,target_id,app_key,action,outcome) values ($1,$2,$3,$4,'ok')",
    [member.user_id, userId, app, visible ? "restore_entry" : "hide_entry"]);
  back(visible ? "Entry restored." : "Entry hidden. Direct site access remains available.");
}

export async function retryProvision(form: FormData) {
  const { apps } = await requireAdministrator();
  const userId = value(form, "userId");
  const app = value(form, "app");
  if (!apps.includes(app)) back("This application is outside your administrator scope.", true);
  try { await provisionAssignment(userId, app); }
  catch (error) { back(error instanceof Error ? error.message : "Provisioning failed.", true); }
  back("Provisioning completed.");
}

export async function assignApplication(form: FormData) {
  const { member, apps } = await requireAdministrator();
  const userId = value(form, "userId");
  const app = value(form, "app");
  if (!apps.includes(app) || !["signora", "ticketing", "riskscreen"].includes(app)) {
    back("This application is outside your administrator scope.", true);
  }
  if (app === "riskscreen" && !member.is_superadmin) back("Only a Super administrator can assign RiskScreen.", true);
  const target = await db().query<{ kind: string; ticketing_department_id: string | null }>(
    "select kind,ticketing_department_id from aideck.members where user_id=$1", [userId],
  );
  if (!target.rows[0]) back("Member not found.", true);
  if (!member.is_superadmin && target.rows[0].kind !== "staff") back("Site administrators can assign only GT staff.", true);
  if (app === "ticketing" && (!target.rows[0].ticketing_department_id || target.rows[0].kind !== "staff")) {
    back("A GT staff member with a Ticketing department is required.", true);
  }
  const role = app === "signora" ? value(form, "role") : app === "ticketing" ? "employee" : null;
  const organizationId = app === "signora" ? value(form, "organizationId") : null;
  if (app === "signora") {
    if (!organizationId || !["junior", "senior"].includes(role ?? "")) back("Choose an ordinary Signora role and Organization.", true);
    const organization = await db().query("select 1 from signora.\"Organization\" where id=$1", [organizationId]);
    if (!organization.rowCount) back("The Signora Organization does not exist.", true);
  }
  await db().query(
    `insert into aideck.assignments(user_id,app_key,site_role,organization_id,visible,provision_status)
     values ($1,$2,$3,$4,true,'pending')
     on conflict(user_id,app_key) do update set visible=true,
       site_role=coalesce(aideck.assignments.site_role,excluded.site_role),
       organization_id=coalesce(aideck.assignments.organization_id,excluded.organization_id),updated_at=now()`,
    [userId, app, role, organizationId],
  );
  try {
    await provisionAssignment(userId, app);
    await db().query("insert into aideck.audit_events(actor_id,target_id,app_key,action,outcome) values($1,$2,$3,'assign_application','ok')",
      [member.user_id, userId, app]);
  } catch (error) {
    back(error instanceof Error ? error.message : "Provisioning failed.", true);
  }
  back("Application assigned.");
}

export async function setOrdinarySignoraRole(form: FormData) {
  const { member, apps } = await requireAdministrator();
  if (!apps.includes("signora")) back("Signora is outside your administrator scope.", true);
  const userId = value(form, "userId");
  const role = value(form, "role");
  if (!["junior", "senior"].includes(role)) back("Only ordinary Signora roles can be selected here.", true);
  const client = await db().connect();
  try {
    await client.query("begin");
    const assignment = await client.query<{ can_manage: boolean; site_role: string | null }>(
      "select can_manage,site_role from aideck.assignments where user_id=$1 and app_key='signora' for update", [userId],
    );
    if (!assignment.rows[0] || assignment.rows[0].can_manage) throw new Error("Revoke site administrator access before changing this role.");
    const changed = await client.query(
      `update signora."User" set role=$2::signora."UserRole","sessionVersion"="sessionVersion"+1,"updatedAt"=now()
       where id=$1 and role in ('junior','senior') returning id`, [userId, role],
    );
    if (!changed.rowCount) throw new Error("The site profile is missing or has a protected role.");
    await client.query("update aideck.assignments set site_role=$2,updated_at=now() where user_id=$1 and app_key='signora'", [userId, role]);
    await client.query("insert into aideck.audit_events(actor_id,target_id,app_key,action,outcome,detail) values($1,$2,'signora','set_site_role','ok',$3)",
      [member.user_id, userId, JSON.stringify({ role })]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    back(error instanceof Error ? error.message : "Role change failed.", true);
  } finally { client.release(); }
  back("Signora role updated.");
}

export async function setSiteAdministrator(form: FormData) {
  const { member } = await requireAdministrator();
  if (!member.is_superadmin) back("Only a Super administrator can change site administrators.", true);
  const userId = value(form, "userId");
  const app = value(form, "app");
  const grant = value(form, "grant") === "true";
  if (app !== "signora" && app !== "ticketing") back("Only connected websites can have site administrators.", true);
  const client = await db().connect();
  try {
    await client.query("begin");
    const target = await client.query<{ kind: string }>("select kind from aideck.members where user_id=$1", [userId]);
    if (target.rows[0]?.kind !== "staff") throw new Error("A site administrator must be GT staff.");
    const assignment = await client.query("select 1 from aideck.assignments where user_id=$1 and app_key=$2 for update", [userId, app]);
    if (!assignment.rowCount) throw new Error("Assign this website before changing its administrator role.");
    if (app === "signora" && !grant) {
      const preview = await client.query<{ organization_id: string | null }>(
        `select "organizationId" as organization_id from signora."User" where id=$1`, [userId],
      );
      if (preview.rows[0]?.organization_id) {
        await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [preview.rows[0].organization_id]);
      }
      const site = await client.query<{ role: string; organization_id: string | null; disabled_at: Date | null }>(
        `select role::text,"organizationId" as organization_id,"disabledAt" as disabled_at
         from signora."User" where id=$1 for update`, [userId],
      );
      const current = site.rows[0];
      if (current?.organization_id !== preview.rows[0]?.organization_id) throw new Error("The Signora Organization changed. Reload and retry.");
      if (current?.role === "admin" && current.organization_id && !current.disabled_at) {
        const others = await client.query(
          `select 1 from signora."User" where "organizationId"=$1 and id<>$2
           and role='admin' and "disabledAt" is null limit 1`, [current.organization_id, userId],
        );
        if (!others.rowCount) throw new Error("Assign another active Signora administrator to this Organization first.");
      }
    }
    const nextRole = grant ? "admin" : app === "signora" ? "junior" : "employee";
    const changed = app === "signora"
      ? await client.query("update signora.\"User\" set role=$2::signora.\"UserRole\",\"sessionVersion\"=\"sessionVersion\"+1,\"updatedAt\"=now() where id=$1 and role<>'superadmin' and (not $3 or (\"disabledAt\" is null and \"organizationId\" is not null)) returning id", [userId, nextRole, grant])
      : await client.query("update gtjbticketing.profiles set role=$2,updated_at=now() where id=$1 and role<>'super_admin' and (not $3 or (account_status='active' and deleted_at is null)) returning id", [userId, nextRole, grant]);
    if (!changed.rowCount) throw new Error("The site profile is missing or has a protected role.");
    await client.query(
      "update aideck.assignments set can_manage=$3,site_role=$4,visible=true,provision_status='ready',updated_at=now() where user_id=$1 and app_key=$2",
      [userId, app, grant, nextRole],
    );
    await client.query("insert into aideck.audit_events(actor_id,target_id,app_key,action,outcome) values ($1,$2,$3,$4,'ok')",
      [member.user_id, userId, app, grant ? "grant_site_admin" : "revoke_site_admin"]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    back(error instanceof Error ? error.message : "Role change failed.", true);
  } finally { client.release(); }
  back(grant ? "Site administrator granted." : "Site administrator revoked.");
}

export async function addUpcomingApplication(form: FormData) {
  const { member } = await requireAdministrator();
  if (!member.is_superadmin) back("Only a Super administrator can add applications.", true);
  const key = value(form, "key").toLowerCase();
  const name = value(form, "name");
  const rawUrl = value(form, "url");
  if (!/^[a-z][a-z0-9-]{2,40}$/.test(key) || !name || name.length > 80) back("Use a short key and name.", true);
  let url: URL;
  try { url = new URL(rawUrl); } catch { back("Enter a valid URL.", true); }
  if (url.protocol !== "https:") back("Use an HTTPS URL.", true);
  const result = await db().query(
    "insert into aideck.applications(key,name,description,kind,url,enabled,sort_order) values ($1,$2,$3,'upcoming',$4,false,100) on conflict (key) do nothing returning key",
    [key, name, value(form, "description"), url.toString()],
  );
  if (!result.rowCount) back("That application key already exists.", true);
  back("Upcoming application saved as unpublished. Connect its login and provisioning before launch.");
}

export async function updateUpcomingApplication(form: FormData) {
  const { member } = await requireAdministrator();
  if (!member.is_superadmin) back("Only a Super administrator can edit applications.", true);
  const key = value(form, "key");
  const name = value(form, "name");
  const rawUrl = value(form, "url");
  if (!name || name.length > 80) back("Enter a name up to 80 characters.", true);
  let url: URL;
  try { url = new URL(rawUrl); } catch { back("Enter a valid URL.", true); }
  if (url.protocol !== "https:") back("Use an HTTPS URL.", true);
  const result = await db().query(
    "update aideck.applications set name=$2,description=$3,url=$4 where key=$1 and kind='upcoming' returning key",
    [key, name, value(form, "description"), url.toString()],
  );
  if (!result.rowCount) back("Only Upcoming applications can be edited here.", true);
  back("Upcoming application updated.");
}
