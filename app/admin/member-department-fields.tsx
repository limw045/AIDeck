"use client";

type Department = { id: string; name: string };

export default function MemberDepartmentFields({ departments, allowClient, kind, onKindChange, ticketingSelected, defaultTicketingDepartmentId = "" }: {
  departments: Department[];
  allowClient: boolean;
  kind: "staff" | "client";
  onKindChange: (kind: "staff" | "client") => void;
  ticketingSelected: boolean;
  defaultTicketingDepartmentId?: string;
}) {
  return <>
    {allowClient ? <label className="admin-field">Member type<select name="kind" value={kind} onChange={(event) => onKindChange(event.target.value as "staff" | "client")}>
      <option value="staff">GT staff</option><option value="client">Client</option>
    </select></label> : <input type="hidden" name="kind" value="staff" />}
    <label className="admin-field">Employment type<select name="employeeType"><option value="full_time">Staff</option><option value="intern">Intern</option><option value="contractor">Contractor</option></select></label>
    {kind === "staff" ? <label className="admin-field admin-field-wide">Department<select key="staff-department" name="ticketingDepartmentId" defaultValue={defaultTicketingDepartmentId} required>
      <option value="">Select a department</option>
      {departments.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
    </select><small>GT staff automatically receive Ticketing access for this department.</small></label> : <>
      <label className="admin-field admin-field-wide">Department<input name="department" maxLength={120} placeholder="Client’s department" required /></label>
      {ticketingSelected && <label className="admin-field admin-field-wide">Ticketing department<select key="client-department" name="ticketingDepartmentId" defaultValue={defaultTicketingDepartmentId} required>
        <option value="">Select when assigning Ticketing</option>
        {departments.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select></label>}
    </>}
  </>;
}
