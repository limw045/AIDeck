"use client";

import { useState } from "react";

type Department = { id: string; name: string };

export default function MemberDepartmentFields({ departments, allowClient, defaultTicketingDepartmentId = "" }: {
  departments: Department[];
  allowClient: boolean;
  defaultTicketingDepartmentId?: string;
}) {
  const [kind, setKind] = useState<"staff" | "client">("staff");

  return <>
    {allowClient ? <label>Central member type<select name="kind" value={kind} onChange={(event) => setKind(event.target.value as "staff" | "client")}>
      <option value="staff">GT staff</option><option value="client">Client</option>
    </select></label> : <input type="hidden" name="kind" value="staff" />}
    {kind === "staff" ? <label>Department<select name="ticketingDepartmentId" defaultValue={defaultTicketingDepartmentId} required>
      <option value="">Select a department</option>
      {departments.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
    </select></label> : <>
      <label>Department<input name="department" maxLength={120} required /></label>
      <label>Ticketing department (if assigning Ticketing)<select name="ticketingDepartmentId" defaultValue={defaultTicketingDepartmentId}>
        <option value="">Select when assigning Ticketing</option>
        {departments.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select></label>
    </>}
  </>;
}
