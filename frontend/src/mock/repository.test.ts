import { describe, expect, it } from "vitest";

import { getWorkspaceDashboard } from "./repository";

describe("getWorkspaceDashboard", () => {
  it("returns the approved AI workspace dashboard", async () => {
    const dashboard = await getWorkspaceDashboard("ws-ai");

    expect(dashboard.workspace.id).toBe("ws-ai");
    expect(dashboard.agent.name).toBe("AI 研发员工");
    expect(dashboard.metrics).toEqual({
      todo: 5,
      runningTasks: 12,
      availableAgents: 1,
      pendingArtifacts: 3,
    });
  });

  it("rejects an unknown workspace instead of returning another scope", async () => {
    await expect(getWorkspaceDashboard("ws-unknown")).rejects.toThrow("Workspace not found");
  });

  it("does not expose credential-looking fields in the serialized snapshot", async () => {
    const dashboard = await getWorkspaceDashboard("ws-ai");

    expect(JSON.stringify(dashboard)).not.toMatch(/api[_-]?key|access[_-]?token|client[_-]?secret/i);
  });
});
