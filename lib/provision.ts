import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Member } from "@/lib/portal";

export type GrantInput = { app: "signora" | "ticketing" | "riskscreen"; role?: string; organizationId?: string };
export type MemberInput = {
  email: string;
  fullName: string;
  department: string;
  employeeType: Member["employee_type"];
  ticketingDepartmentId: string | null;
  kind: Member["kind"];
  grants: GrantInput[];
};

export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  return email;
}

export function validateMemberInput(input: MemberInput, approvingExisting = false) {
  normalizeEmail(input.email);
  if (!input.fullName.trim() || input.fullName.length > 120) throw new Error("Enter a name up to 120 characters.");
  if (!input.department.trim() || input.department.length > 120) throw new Error("Enter a department up to 120 characters.");
  if (!["full_time", "intern", "contractor"].includes(input.employeeType)) throw new Error("Select a valid employee type.");
  if (!["staff", "client"].includes(input.kind)) throw new Error("Select a valid member kind.");
  if ((input.kind === "staff" || input.grants.some((grant) => grant.app === "ticketing"))
    && !input.ticketingDepartmentId) {
    throw new Error("Select a Ticketing department for GT staff or anyone assigned Ticketing.");
  }
  for (const grant of input.grants) {
    if (!["signora", "ticketing", "riskscreen"].includes(grant.app)) throw new Error("Unknown application.");
    const allowedSignoraRoles = approvingExisting ? ["junior", "senior", "admin", "superadmin"] : ["junior", "senior"];
    if (grant.app === "signora" && (!allowedSignoraRoles.includes(grant.role ?? "")
      || (!grant.organizationId && grant.role !== "superadmin"))) {
      throw new Error("Choose a Signora Organization and role.");
    }
  }
}

async function findAuthUser(email: string): Promise<string | null> {
  const admin = supabaseAdmin();
  const matches: string[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("Could not check existing Auth identities.");
    for (const user of data.users) {
      if (user.email?.toLowerCase() === email) matches.push(user.id);
    }
    if (matches.length > 1) throw new Error("More than one Auth identity matches this email. Review it manually.");
    if (data.users.length < 1000) break;
  }
  return matches[0] ?? null;
}

export async function inviteOrApprove(input: MemberInput, actorId: string, existingUserId?: string) {
  validateMemberInput(input, Boolean(existingUserId));
  const email = normalizeEmail(input.email);
  let userId = existingUserId ?? await findAuthUser(email);
  let isNewAuthUser = false;
  if (existingUserId) {
    const { data, error } = await supabaseAdmin().auth.admin.getUserById(existingUserId);
    if (error || data.user?.email?.toLowerCase() !== email) throw new Error("The selected Auth user does not match this email.");
  }
  if (!userId) {
    const base = process.env.PORTAL_URL;
    if (!base) throw new Error("PORTAL_URL is not configured.");
    const redirectTo = new URL("/auth/callback", base).toString();
    const { data, error } = await supabaseAdmin().auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error || !data.user) throw new Error(error?.message ?? "Could not invite this email.");
    userId = data.user.id;
    isNewAuthUser = true;
  }

  const grants = input.kind === "staff" && !input.grants.some((grant) => grant.app === "ticketing")
    ? [...input.grants, { app: "ticketing" as const, role: "employee" }]
    : input.grants;

  const client = await db().connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into aideck.members (user_id,email,full_name,department,employee_type,ticketing_department_id,kind,status,invited_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (user_id) do update set full_name=excluded.full_name, department=excluded.department,
         employee_type=excluded.employee_type, ticketing_department_id=coalesce(excluded.ticketing_department_id,aideck.members.ticketing_department_id),
         kind=case when aideck.members.kind='staff' then 'staff' else excluded.kind end, updated_at=now()`,
      [userId, email, input.fullName.trim(), input.department.trim(), input.employeeType,
        input.ticketingDepartmentId, input.kind, isNewAuthUser ? "invited" : "active", actorId],
    );
    await client.query(
      `insert into public.profiles (id,email,display_name) values ($1,$2,$3)
       on conflict (id) do nothing`, [userId, email, input.fullName.trim()],
    );
    for (const grant of grants) {
      await client.query(
        `insert into aideck.assignments (user_id,app_key,site_role,organization_id,visible,provision_status)
         values ($1,$2,$3,$4,true,'pending')
         on conflict (user_id,app_key) do update set visible=true,
           site_role=coalesce(excluded.site_role,aideck.assignments.site_role),
           organization_id=coalesce(excluded.organization_id,aideck.assignments.organization_id),
           provision_status=case when aideck.assignments.provision_status='ready' then 'ready' else 'pending' end,
           updated_at=now()`,
        [userId, grant.app, grant.role ?? null, grant.organizationId ?? null],
      );
    }
    await client.query(
      "insert into aideck.audit_events(actor_id,target_id,action,outcome,detail) values ($1,$2,'invite_or_approve','ok',$3)",
      [actorId, userId, JSON.stringify({ apps: grants.map((grant) => grant.app), newAuthUser: isNewAuthUser })],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const results: { app: string; ok: boolean; error?: string }[] = [];
  for (const grant of grants) {
    try {
      await provisionAssignment(userId, grant.app);
      results.push({ app: grant.app, ok: true });
    } catch (error) {
      results.push({ app: grant.app, ok: false, error: error instanceof Error ? error.message : "Provisioning failed" });
    }
  }
  return { userId, isNewAuthUser, results };
}

export async function provisionAssignment(userId: string, app: string) {
  const client = await db().connect();
  try {
    await client.query("begin");
    const memberResult = await client.query<Member>("select * from aideck.members where user_id=$1", [userId]);
    const member = memberResult.rows[0];
    const grantResult = await client.query<{ site_role: string | null; organization_id: string | null }>(
      "select site_role,organization_id from aideck.assignments where user_id=$1 and app_key=$2 for update", [userId, app],
    );
    const grant = grantResult.rows[0];
    if (!member || !grant) throw new Error("Member or assignment is missing.");
    let actualRole = grant.site_role;

    if (app === "ticketing") {
      if (!member.ticketing_department_id) throw new Error("A Ticketing department is required.");
      const department = await client.query<{ name: string }>(
        "select name from gtjbticketing.departments where id=$1 and is_active and not is_system", [member.ticketing_department_id],
      );
      if (!department.rows[0]) throw new Error("Choose an active Ticketing department.");
      await client.query(
        `insert into gtjbticketing.profiles
          (id,email,display_name,user_type,department,department_id,role,account_status)
         values ($1,$2,$3,$4,$5,$6,'employee','active') on conflict (id) do nothing`,
        [userId, member.email, member.full_name, member.employee_type,
          department.rows[0].name, member.ticketing_department_id],
      );
      const profile = await client.query<{ role: string; account_status: string; deleted_at: Date | null }>(
        "select role,account_status,deleted_at from gtjbticketing.profiles where id=$1", [userId],
      );
      if (profile.rows[0]?.account_status !== "active" || profile.rows[0].deleted_at) {
        throw new Error("The Ticketing profile is not active.");
      }
      actualRole = profile.rows[0].role;
    } else if (app === "signora") {
      const profile = await client.query<{ role: string; disabled_at: Date | null; organization_id: string | null }>(
        `select role::text,disabled_at,organization_id
         from signora.users where id=$1`, [userId],
      );
      if (profile.rows[0]) {
        if (profile.rows[0].disabled_at || (profile.rows[0].role !== "superadmin" && !profile.rows[0].organization_id)) {
          throw new Error("The Signora profile is not active.");
        }
        actualRole = profile.rows[0].role;
      } else {
        if (!grant.organization_id || !["junior", "senior"].includes(grant.site_role ?? "")) {
          throw new Error("A Signora Organization and ordinary role are required.");
        }
        const organization = await client.query("select id from signora.organizations where id=$1", [grant.organization_id]);
        if (!organization.rowCount) throw new Error("The selected Signora Organization does not exist.");
        await client.query(
          `insert into signora.users (id,email,name,role,organization_id,session_version,created_at,updated_at)
           values ($1,$2,$3,$4::signora."UserRole",$5,0,now(),now())`,
          [userId, member.email, member.full_name, grant.site_role, grant.organization_id],
        );
        actualRole = grant.site_role;
      }
    } else if (app !== "riskscreen") {
      throw new Error("This application is upcoming.");
    }

    await client.query(
      `update aideck.assignments set provision_status='ready',provision_error=null,site_role=$3,updated_at=now()
       where user_id=$1 and app_key=$2`, [userId, app, actualRole],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    await client.query(
      `update aideck.assignments set provision_status='failed',provision_error=$3,updated_at=now()
       where user_id=$1 and app_key=$2`,
      [userId, app, error instanceof Error ? error.message.slice(0, 300) : "Provisioning failed"],
    );
    throw error;
  } finally {
    client.release();
  }
}
