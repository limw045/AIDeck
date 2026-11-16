export type InstallerAsset = { id: number; name: string; size: number; sha256: string };

export function selectInstaller(value: unknown): InstallerAsset | null {
  if (!value || typeof value !== "object") return null;
  const release = value as Record<string, unknown>;
  if (release.draft !== false || release.prerelease !== false || !Array.isArray(release.assets)
    || typeof release.tag_name !== "string") return null;
  const version = /^v?(\d+\.\d+\.\d+)$/.exec(release.tag_name)?.[1];
  if (!version) return null;
  const name = `RiskScreen-Setup-${version}.exe`;
  const asset = release.assets.find((item) => item && typeof item === "object" && item.name === name
    && item.state === "uploaded") as Record<string, unknown> | undefined;
  if (!asset || !Number.isSafeInteger(asset.id) || !Number.isSafeInteger(asset.size)
    || (asset.size as number) < 1 || (asset.size as number) > 1024 * 1024 * 1024
    || typeof asset.digest !== "string" || !/^sha256:[a-f0-9]{64}$/i.test(asset.digest)) return null;
  const sha256 = asset.digest.slice(7).toLowerCase();
  const notesDigest = /Installer SHA-256:\s*([a-f0-9]{64})/i.exec(typeof release.body === "string" ? release.body : "")?.[1]?.toLowerCase();
  if (notesDigest && notesDigest !== sha256) return null;
  return { id: asset.id as number, name, size: asset.size as number, sha256 };
}
