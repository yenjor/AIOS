import { DashboardScreen } from "@/features/workspace/dashboard-screen";
import { getWorkspaceDashboard } from "@/mock/repository";

export default async function WorkspacePage() {
  const snapshot = await getWorkspaceDashboard("ws-ai");

  return <DashboardScreen snapshot={snapshot} />;
}
