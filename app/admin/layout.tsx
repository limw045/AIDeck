import type { ReactNode } from "react";
import { requireAdministrator } from "@/lib/portal";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import "./admin.css";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { member } = await requireAdministrator();
  return <WorkspaceShell member={member} canAdmin>{children}</WorkspaceShell>;
}
