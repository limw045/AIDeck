"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "@/app/components/symbols";
import { adminExistingUrl, applicationNames, readableLabel, type AdminMemberFilters } from "@/lib/admin-ui";
import { inviteMember, approveExisting } from "./actions";
import MemberDepartmentFields from "./member-department-fields";
import SubmitButton from "./submit-button";

type Option = { id: string; name: string };
type ExistingMember = { id: string; email: string; name: string | null; role: string; source: "signora" | "ticketing"; organization_id: string | null; department_id: string | null };

const applicationIcons: Record<string, IconName> = { ticketing: "ticket", signora: "pen", riskscreen: "shield" };

export default function MemberForm({ departments, organizations, apps, allowClient, existing, filters = { q: "", status: "all" } }: {
  departments: Option[]; organizations: Option[]; apps: string[]; allowClient: boolean; existing?: ExistingMember; filters?: AdminMemberFilters;
}) {
  const [kind, setKind] = useState<"staff" | "client">("staff");
  const [signora, setSignora] = useState(existing?.source === "signora");
  const [ticketing, setTicketing] = useState(existing?.source === "ticketing");
  const existingSignora = existing?.source === "signora";
  const automaticTicketing = kind === "staff";
  const available = ["ticketing", "signora", "riskscreen"].filter((app) => apps.includes(app) || (app === "ticketing" && automaticTicketing));

  return <form action={existing ? approveExisting : inviteMember} className="admin-member-form">
    {existing && <><input type="hidden" name="userId" value={existing.id} /><input type="hidden" name="source" value={existing.source} /><input type="hidden" name="q" value={filters.q} /><input type="hidden" name="status" value={filters.status} /></>}
    <div className="admin-form-columns">
      <div>
        <section className="admin-card" aria-labelledby="member-details-heading">
          <div className="admin-card-heading"><h3 id="member-details-heading">Member details</h3></div>
          <div className="admin-form-grid">
            <label className="admin-field admin-field-wide">Work email<input name="email" type="email" placeholder="name@company.com" autoComplete="email" defaultValue={existing?.email} readOnly={Boolean(existing)} required /></label>
            <label className="admin-field admin-field-wide">Full name<input name="fullName" placeholder="Full name" autoComplete="name" defaultValue={existing?.name ?? ""} maxLength={120} required /></label>
            <MemberDepartmentFields departments={departments} allowClient={allowClient} kind={kind} onKindChange={setKind} ticketingSelected={ticketing} defaultTicketingDepartmentId={existing?.department_id ?? ""} />
          </div>
        </section>
        <p className="admin-context-note"><Icon name={existing ? "shield" : "mail"} size={17} /><span>{existing ? "Verify the name and email. Existing accounts and roles are retained." : "New members receive a setup email. Existing accounts keep their sign-in details."}</span></p>
      </div>
      <aside>
        <fieldset className="admin-card admin-access-card"><legend>Application access</legend>
          {available.map((app) => {
            const automatic = app === "ticketing" && automaticTicketing;
            return <div className="admin-access-option" key={app}>
              <label className="admin-app-choice">
                <input type="checkbox" name="apps" value={app} disabled={automatic} checked={app === "signora" ? signora : app === "ticketing" ? automatic || ticketing : undefined} onChange={app === "signora" ? (event) => setSignora(event.target.checked) : app === "ticketing" ? (event) => setTicketing(event.target.checked) : undefined} />
                <span className="admin-app-icon"><Icon name={applicationIcons[app]} size={18} /></span>
                <span className="admin-choice-copy"><strong>{applicationNames[app]}</strong></span>
                {automatic && <span className="admin-mini-tag">Automatic</span>}
              </label>
              {app === "signora" && signora && <div className="admin-access-fields">
                <label className="admin-field">Organization<select name="organizationId" defaultValue={existing?.organization_id ?? ""} disabled={existingSignora} required={!existingSignora || existing?.role !== "superadmin"}>
                  <option value="">{existingSignora && existing.role === "superadmin" ? "Not required for super administrators" : "Select an organization"}</option>
                  {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                </select></label>
                {existingSignora && <input type="hidden" name="organizationId" value={existing.organization_id ?? ""} />}
                {existingSignora ? <><label className="admin-field">Current Signora role<input value={readableLabel(existing.role)} readOnly /></label><input type="hidden" name="signoraRole" value={existing.role} /></> : <label className="admin-field">Signora role<select name="signoraRole"><option value="junior">Junior</option><option value="senior">Senior</option></select></label>}
              </div>}
            </div>;
          })}
          {available.length === 0 && <p>No applications are available in your administrator scope.</p>}
        </fieldset>
      </aside>
    </div>
    <div className="admin-form-footer"><Link className="button secondary" href={existing ? adminExistingUrl(filters.q, filters.status) : "/admin?section=members"}>Cancel</Link><SubmitButton pendingLabel={existing ? "Approving…" : "Sending invitation…"}><Icon name={existing ? "check" : "mail"} size={16} />{existing ? "Approve for workspace" : "Invite or add member"}</SubmitButton></div>
  </form>;
}
