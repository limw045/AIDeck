import { test } from "node:test";
import assert from "node:assert/strict";
import { selectInstaller } from "../lib/riskscreen-release.ts";

const sha = "a".repeat(64);
const release = () => ({ tag_name: "v1.2.3", draft: false, prerelease: false,
  body: `Installer SHA-256: ${sha.toUpperCase()}`,
  assets: [{ id: 42, name: "RiskScreen-Setup-1.2.3.exe", state: "uploaded",
    size: 163 * 1024 * 1024, digest: `sha256:${sha}` }] });

test("selects only the published installer with matching release digest", () => {
  assert.deepEqual(selectInstaller(release()), { id: 42, name: "RiskScreen-Setup-1.2.3.exe",
    size: 163 * 1024 * 1024, sha256: sha });
  assert.equal(selectInstaller({ ...release(), draft: true }), null);
  assert.equal(selectInstaller({ ...release(), prerelease: true }), null);
  assert.equal(selectInstaller({ ...release(), tag_name: "v1.2.3-beta" }), null);
});

test("rejects incomplete or conflicting installer metadata", () => {
  assert.equal(selectInstaller({ ...release(), body: `Installer SHA-256: ${"b".repeat(64)}` }), null);
  assert.equal(selectInstaller({ ...release(), assets: [{ ...release().assets[0], digest: null }] }), null);
  assert.equal(selectInstaller({ ...release(), assets: [{ ...release().assets[0], size: 0 }] }), null);
  assert.equal(selectInstaller({ ...release(), assets: [{ ...release().assets[0], name: "other.exe" }] }), null);
});
