import { test } from "node:test";
import assert from "node:assert/strict";
import { adminSection, adminFeedbackUrl, filterAdminMembers } from "../lib/admin-ui.ts";

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
