export const adminSections = [
  { key: "members", label: "Members" },
  { key: "invite", label: "Invite member" },
  { key: "existing", label: "Existing users" },
  { key: "catalog", label: "Applications" },
  { key: "activity", label: "Activity" },
] as const;

export type AdminSection = typeof adminSections[number]["key"];

export function adminSection(value: unknown, isSuperadmin: boolean): AdminSection {
  return adminSections.find(({ key }) => key === value && (isSuperadmin || !["existing", "catalog"].includes(key)))?.key ?? "invite";
}

export function adminFeedbackUrl(message: string, error = false, section: AdminSection = "members", memberId?: string) {
  const params = new URLSearchParams({ section, [error ? "error" : "notice"]: message.slice(0, 240) });
  if (section === "members" && memberId) params.set("member", memberId);
  return `/admin?${params}`;
}

export function filterAdminMembers<T extends { full_name: string; email: string; status: string }>(members: T[], query: unknown, status: unknown) {
  const search = typeof query === "string" ? query.trim().toLowerCase() : "";
  const state = typeof status === "string" && ["active", "invited", "suspended"].includes(status) ? status : "all";
  return members.filter((member) => `${member.full_name} ${member.email}`.toLowerCase().includes(search) && (state === "all" || member.status === state));
}

export const applicationNames: Record<string, string> = {
  signora: "Signora", ticketing: "GT AI Ticketing", riskscreen: "RiskScreen", sessiontrack: "Session Track",
};

export function readableLabel(value: string) {
  const words = value.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
