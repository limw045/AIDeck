export const adminSections = [
  { key: "members", label: "Members" },
  { key: "invite", label: "Invite member" },
  { key: "existing", label: "Existing users" },
  { key: "catalog", label: "Applications" },
  { key: "activity", label: "Activity" },
] as const;

export type AdminSection = typeof adminSections[number]["key"];
export type AdminMemberFilters = { q: string; status: "all" | "active" | "invited" | "suspended" };

export function adminSection(value: unknown, isSuperadmin: boolean): AdminSection {
  return adminSections.find(({ key }) => key === value && (isSuperadmin || !["existing", "catalog"].includes(key)))?.key ?? "invite";
}

export function adminMemberFilters(query: unknown, status: unknown): AdminMemberFilters {
  return {
    q: typeof query === "string" ? query.trim().slice(0, 120) : "",
    status: typeof status === "string" && ["active", "invited", "suspended"].includes(status) ? status as AdminMemberFilters["status"] : "all",
  };
}

export function adminMemberUrl(query: unknown, status: unknown, memberId?: string) {
  const filters = adminMemberFilters(query, status);
  const params = new URLSearchParams({ section: "members" });
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "all") params.set("status", filters.status);
  if (memberId) params.set("member", memberId);
  return `/admin?${params}`;
}

export function adminExistingUrl(query: unknown, status: unknown) {
  const filters = adminMemberFilters(query, status);
  const params = new URLSearchParams({ section: "existing" });
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "all") params.set("status", filters.status);
  return `/admin?${params}`;
}

export function adminFeedbackUrl(message: string, error = false, section: AdminSection = "members", memberId?: string, filters?: Pick<AdminMemberFilters, "q" | "status">) {
  const params = new URLSearchParams({ section, [error ? "error" : "notice"]: message.slice(0, 240) });
  if (section === "members" && memberId) params.set("member", memberId);
  if (section === "members" && filters) {
    const valid = adminMemberFilters(filters.q, filters.status);
    if (valid.q) params.set("q", valid.q);
    if (valid.status !== "all") params.set("status", valid.status);
  }
  return `/admin?${params}`;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function adminExistingReviewUrl(source: unknown, id: unknown, query: unknown, status: unknown, error?: string) {
  if ((source !== "signora" && source !== "ticketing") || !isUuid(id)) return adminExistingUrl(query, status);
  const filters = adminMemberFilters(query, status);
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "all") params.set("status", filters.status);
  if (error) params.set("error", error.slice(0, 240));
  const search = params.toString();
  return `/admin/existing/${source}/${id}${search ? `?${search}` : ""}`;
}

export function filterAdminMembers<T extends { full_name: string; email: string; status: string }>(members: T[], query: unknown, status: unknown) {
  const filters = adminMemberFilters(query, status);
  return members.filter((member) => `${member.full_name} ${member.email}`.toLowerCase().includes(filters.q.toLowerCase()) && (filters.status === "all" || member.status === filters.status));
}

export const applicationNames: Record<string, string> = {
  signora: "Signora", ticketing: "GT AI Ticketing", riskscreen: "RiskScreen", sessiontrack: "Session Track",
};

export function readableLabel(value: string) {
  const words = value.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
