import { requireMember, visibleApplications, managedApps } from "@/lib/portal";
import { WorkspaceShell } from "./components/workspace-shell";
import { ApplicationCatalog } from "./components/application-catalog";

export default async function Home() {
  const member = await requireMember();
  const [applications, apps] = await Promise.all([visibleApplications(member), managedApps(member)]);
  const oauthReady = { signora: process.env.SIGNORA_OAUTH_READY === "true", ticketing: process.env.TICKETING_OAUTH_READY === "true" };
  const downloadReady = Boolean(process.env.GITHUB_RELEASE_TOKEN);
  return <WorkspaceShell member={member} canAdmin={member.is_superadmin || apps.length > 0}><ApplicationCatalog applications={applications} oauthReady={oauthReady} downloadReady={downloadReady} /></WorkspaceShell>;
}
