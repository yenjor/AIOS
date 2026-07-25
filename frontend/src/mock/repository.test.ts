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

  it("returns the approved todos and risks", async () => {
    const dashboard = await getWorkspaceDashboard("ws-ai");

    expect(dashboard.todos).toEqual([
      { id: "todo-001", title: "订单服务性能优化方案", artifactType: "技术方案", action: "去审批" },
      { id: "todo-002", title: "支付模块自动化测试报告", artifactType: "测试报告", action: "去验收" },
      { id: "todo-003", title: "商品搜索功能需求分析", artifactType: "需求分析报告", action: "去处理" },
    ]);
    expect(dashboard.risks).toEqual([
      { id: "risk-001", title: "需求澄清不足", detail: "商品搜索功能仍有 3 条澄清项等待确认", tone: "warning" },
      { id: "risk-002", title: "Task 超期", detail: "用户中心接口文档更新已超过期望完成时间", tone: "error" },
    ]);
  });
});
