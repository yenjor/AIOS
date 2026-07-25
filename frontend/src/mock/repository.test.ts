import { describe, expect, it } from "vitest";

import { organization, users, workspace, workspaceDashboard } from "./fixtures";
import { getWorkspaceDashboard } from "./repository";

const forbiddenKeyNames = new Set([
  "apikey",
  "accesstoken",
  "clientsecret",
  "password",
  "privatekey",
  "refreshtoken",
  "authorization",
]);

function assertFixtureTreeHasNoSecrets(value: unknown): void {
  if (typeof value === "string") {
    expect(value).not.toMatch(/^sk-[a-z0-9_-]+/i);
    expect(value).not.toMatch(/-----BEGIN .* PRIVATE KEY-----/i);
    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    expect(forbiddenKeyNames).not.toContain(key.replace(/[ _-]/g, "").toLowerCase());
    assertFixtureTreeHasNoSecrets(nestedValue);
  }
}

function expectFixtureTreeToBeFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") {
    return;
  }

  expect(Object.isFrozen(value)).toBe(true);

  for (const nestedValue of Object.values(value)) {
    expectFixtureTreeToBeFrozen(nestedValue);
  }
}

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

  it("exports stable organization, workspace, and user fixture identities", () => {
    expect(organization).toEqual({ id: "org-guangwei", name: "光位科技" });
    expect(workspace).toMatchObject({
      id: "ws-ai",
      organizationId: "org-guangwei",
      name: "AI 智能业务线",
    });
    expect(users).toEqual([
      { id: "user-pm", name: "林悦", role: "产品经理" },
      { id: "user-dev", name: "周航", role: "开发工程师" },
      { id: "user-lead", name: "陈明", role: "研发负责人" },
      { id: "user-admin", name: "吴桐", role: "Workspace Admin" },
      { id: "user-auditor", name: "赵岚", role: "Auditor" },
    ]);
  });

  it("uses consumer-compatible owner and task type fields", async () => {
    const dashboard = await getWorkspaceDashboard("ws-ai");

    expect(workspaceDashboard.currentUser).toBe(users[2]);
    expect(dashboard.agent.owner).toBe("陈明");
    expect(dashboard.tasks.map(({ id, type }) => ({ id, type }))).toEqual([
      { id: "task-001", type: "研发实现" },
      { id: "task-002", type: "技术方案" },
      { id: "task-003", type: "自动测试" },
      { id: "task-004", type: "分析需求" },
    ]);
    expect(dashboard.tasks[0]).not.toHaveProperty("stage");
  });

  it("keeps canonical fixtures frozen while returning isolated mutable results", async () => {
    expectFixtureTreeToBeFrozen(workspaceDashboard);

    const firstDashboard = await getWorkspaceDashboard("ws-ai");
    firstDashboard.metrics.todo = 0;
    firstDashboard.tasks[0].title = "已修改";

    const subsequentDashboard = await getWorkspaceDashboard("ws-ai");
    expect(subsequentDashboard.metrics.todo).toBe(5);
    expect(subsequentDashboard.tasks[0].title).toBe("用户中心登录流程重构");
  });

  it("keeps the real fixture tree free of credential-like keys and secret values", () => {
    assertFixtureTreeHasNoSecrets(workspaceDashboard);
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
