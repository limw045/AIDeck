import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { requireMember, managedApps } from "@/lib/portal";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { QRStudio } from "./qr-studio";
import "./qr-studio.css";

export const metadata = { title: "QR Studio" };

export default async function QRStudioPage() {
  const member = await requireMember();
  const [apps, html] = await Promise.all([
    managedApps(member),
    readFile(path.join(process.cwd(), "assets/qr-studio/index.html"), "utf8"),
  ]);
  return <WorkspaceShell member={member} canAdmin={member.is_superadmin || apps.length > 0}>
    <div className="page-heading"><h1>QR Studio</h1><Link className="button secondary" href="/">Back to applications</Link></div>
    <QRStudio html={html} />
  </WorkspaceShell>;
}
