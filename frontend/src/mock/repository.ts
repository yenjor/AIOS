import type { WorkspaceDashboard } from "@/types/domain";

import { workspaceDashboard } from "./fixtures";

export const MOCK_LATENCY_MS = 30;

export async function getWorkspaceDashboard(workspaceId: string): Promise<WorkspaceDashboard> {
  await new Promise<void>((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

  if (workspaceId !== workspaceDashboard.workspace.id) {
    throw new Error("未找到工作空间");
  }

  return structuredClone(workspaceDashboard) as WorkspaceDashboard;
}
