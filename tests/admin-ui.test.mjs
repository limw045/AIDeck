import { test } from "node:test";
import assert from "node:assert/strict";
import { adminSection, adminFeedbackUrl, adminMemberFilters, adminMemberUrl, filterAdminMembers, isUuid } from "../lib/admin-ui.ts";

test("Admin sections default safely and respect super administrator scope", () => {
  assert.equal(adminSection(undefined, true), "invite");
  assert.equal(adminSection("members", false), "members");
  assert.equal(adminSection("catalog", true), "catalog");
  for (const value of ["catalog", "existing", "https://evil.test", ["members"]]) {
    assert.equal(adminSection(value, false), "invite");
  }
});

test("member search combines name or email with status without modifying data", () => {
  const members = [
    { full_name: "Sarah Lim", email: "sarah@example.test", status: "active" },
    { full_name: "Daniel Wong", email: "daniel@example.test", status: "invited" },
  ];
  assert.deepEqual(filterAdminMembers(members, " SARAH ", "active"), [members[0]]);
  assert.deepEqual(filterAdminMembers(members, "example.test", "invited"), [members[1]]);
  assert.deepEqual(filterAdminMembers(members, "Sarah", "invited"), []);
  assert.deepEqual(filterAdminMembers(members, ["Sarah"], "invalid"), members);
  assert.equal(members.length, 2);
});

test("action feedback stays local and preserves its section with encoded messages", () => {
  const url = new URL(adminFeedbackUrl("Saved & ready? #yes", false, "catalog"), "https://portal.test");
  assert.equal(url.pathname, "/admin");
  assert.equal(url.searchParams.get("section"), "catalog");
  assert.equal(url.searchParams.get("notice"), "Saved & ready? #yes");
  assert.equal(new URL(adminFeedbackUrl("x".repeat(300), true), url).searchParams.get("error").length, 240);
});

test("member feedback retains its target on success and failure without affecting other sections", () => {
  for (const error of [false, true]) {
    const url = new URL(adminFeedbackUrl("Updated", error, "members", "member & name"), "https://portal.test");
    assert.equal(url.pathname, "/admin");
    assert.equal(url.searchParams.get("member"), "member & name");
    assert.equal(url.searchParams.get(error ? "error" : "notice"), "Updated");
  }
  assert.equal(new URL(adminFeedbackUrl("Invited", false, "invite", "member-id"), "https://portal.test").searchParams.has("member"), false);
});

test("member detail and return links preserve only valid filters", () => {
  const detail = new URL(adminMemberUrl("  a & b  ", "active", "user & id"), "https://portal.test");
  assert.equal(detail.pathname, "/admin");
  assert.equal(detail.searchParams.get("section"), "members");
  assert.equal(detail.searchParams.get("member"), "user & id");
  assert.equal(detail.searchParams.get("q"), "a & b");
  assert.equal(detail.searchParams.get("status"), "active");
  assert.equal(adminMemberUrl(["bad"], "invalid"), "/admin?section=members");
  assert.deepEqual(adminMemberFilters("x".repeat(130), "all"), { q: "x".repeat(120), status: "all" });
});

test("member action feedback safely retains valid filters and target", () => {
  const url = new URL(adminFeedbackUrl("Updated", true, "members", "user-id", { q: "name & email", status: "suspended" }), "https://portal.test");
  assert.equal(url.searchParams.get("member"), "user-id");
  assert.equal(url.searchParams.get("q"), "name & email");
  assert.equal(url.searchParams.get("status"), "suspended");
  const invalid = new URL(adminFeedbackUrl("Updated", true, "members", "user-id", { q: ["bad"], status: "external" }), "https://portal.test");
  assert.equal(invalid.searchParams.has("q"), false);
  assert.equal(invalid.searchParams.has("status"), false);
});

test("review route UUID guard accepts canonical UUIDs only", () => {
  assert.equal(isUuid("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isUuid("550E8400-E29B-41D4-A716-446655440000"), true);
  for (const value of ["not-a-uuid", "550e8400-e29b-41d4-a716-44665544000z", ["550e8400-e29b-41d4-a716-446655440000"], ""]) {
    assert.equal(isUuid(value), false);
  }
});
