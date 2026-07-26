import { beforeEach, describe, expect, it } from "vitest";

import type { TaskActor, TaskDraft, TaskScope } from "../model";
import { TASK_STATUSES } from "../task-status";
import {
  createTaskRepository,
  TASK_STORE_KEY,
  TaskRepositoryError,
} from "./task-repository";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const scope: TaskScope = {
  organizationId: "org-guangwei",
  workspaceId: "ws-ai",
};
const lead: TaskActor = { userId: "user-lead" };
const developer: TaskActor = { userId: "user-dev" };
const productManager: TaskActor = { userId: "user-pm" };
const auditor: TaskActor = { userId: "user-auditor" };

const technicalSolutionDraft: TaskDraft = {
  templateName: "生成技术方案",
  title: "设计 Task Center 黄金路径",
  goal: "形成可供研发团队评审并实施的技术方案",
  constraints: ["遵循现有模块边界", "只使用当前 Workspace 已授权资料"],
  outOfScope: ["不修改生产系统", "不执行写入类 Tool"],
  priority: 50,
  riskLevel: "R1",
  capabilityVersionRefs: [
    {
      kind: "CAPABILITY",
      objectId: "capability-technical-solution",
      versionId: "capability-technical-solution-v1",
      versionNumber: 1,
      digest: "sha256:capability-technical-solution-v1",
    },
  ],
  knowledgeVersionRefs: [
    {
      kind: "KNOWLEDGE",
      objectId: "knowledge-aios-docs",
      versionId: "knowledge-aios-docs-v1",
      versionNumber: 1,
      digest: "sha256:knowledge-aios-docs-v1",
    },
  ],
  toolVersionRefs: [
    {
      kind: "TOOL",
      objectId: "tool-codegraph-read",
      versionId: "tool-codegraph-read-v1",
      versionNumber: 1,
      digest: "sha256:tool-codegraph-read-v1",
      actionId: "codegraph.context",
      operationType: "READ",
    },
  ],
  assignedAgent: {
    agentId: "agent-rd-001",
    agentName: "AI研发员工",
    agentVersionRef: {
      kind: "AGENT",
      objectId: "agent-rd-001",
      versionId: "agent-rd-001-v1",
      versionNumber: 1,
      digest: "sha256:agent-rd-001-v1",
    },
    autonomyLevel: "L1辅助",
    humanOwner: {
      userId: "user-lead",
      displayName: "陈明",
    },
  },
  expectedArtifact: {
    artifactType: "技术方案",
    state: "EXPECTED",
    sections: [
      "目标理解",
      "范围与不做事项",
      "影响模块与文件",
      "技术决策",
      "风险",
      "测试建议",
      "回退考虑",
      "Knowledge Citation",
    ],
    knowledgeCitationRequired: true,
  },
  completionCriteria: [
    "技术方案包含约定的全部章节",
    "关键判断包含 Knowledge Citation",
    "由人类 Reviewer 完成 Artifact 验收",
  ],
};

function expectRepositoryError(
  error: unknown,
  code: TaskRepositoryError["code"],
): boolean {
  expect(error).toBeInstanceOf(TaskRepositoryError);
  expect((error as TaskRepositoryError).code).toBe(code);
  return true;
}

describe("Task mock repository", () => {
  let storage: MemoryStorage;
  let delayCalls: number;

  beforeEach(() => {
    storage = new MemoryStorage();
    delayCalls = 0;
  });

  function repository() {
    return createTaskRepository({
      storage,
      delay: async () => {
        delayCalls += 1;
      },
      now: () => "2026-07-26T08:00:00.000Z",
    });
  }

  it("uses injectable latency without sleeping and returns all twelve seed states", async () => {
    const page = await repository().listTasks(scope, lead, {
      page: 1,
      pageSize: 20,
    });

    expect(delayCalls).toBe(1);
    expect(page.total).toBe(12);
    expect(new Set(page.items.map(({ status }) => status))).toEqual(
      new Set(TASK_STATUSES),
    );
  });

  it("validates the fixture scope and actor on every operation", async () => {
    const repo = repository();
    const invalidScope = {
      organizationId: "org-other",
      workspaceId: "ws-ai",
    };
    const invalidActor = { userId: "user-other" };

    await expect(repo.listTasks(invalidScope, lead, {})).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "NOT_FOUND"),
    );
    await expect(repo.getTask(scope, invalidActor, "task-seed-draft")).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "FORBIDDEN"),
    );
    await expect(repo.getDraft(invalidScope, lead)).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "NOT_FOUND"),
    );
  });

  it("allows Auditor to list and get but forbids every write operation", async () => {
    const repo = repository();
    const page = await repo.listTasks(scope, auditor, { pageSize: 20 });
    await expect(repo.getTask(scope, auditor, page.items[0].id)).resolves.toBeDefined();

    await expect(repo.saveDraft(scope, auditor, { title: "只读审计" })).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "FORBIDDEN"),
    );
    await expect(repo.discardDraft(scope, auditor)).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "FORBIDDEN"),
    );
    await expect(repo.submitTechnicalSolutionTask(scope, auditor)).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "FORBIDDEN"),
    );
  });

  it.each(["user-pm", "user-dev", "user-lead", "user-admin"])(
    "allows the approved creator identity %s to save and discard a draft",
    async (userId) => {
      const repo = repository();
      const actor = { userId };

      await expect(repo.saveDraft(scope, actor, {
        templateName: "生成技术方案",
        title: `草稿-${userId}`,
      })).resolves.toMatchObject({ title: `草稿-${userId}` });
      await expect(repo.discardDraft(scope, actor)).resolves.toBeUndefined();
    },
  );

  it("isolates drafts by organization, workspace, and actor and restores them after recreation", async () => {
    const firstRepository = repository();
    await firstRepository.saveDraft(scope, lead, {
      templateName: "生成技术方案",
      title: "仅陈明可恢复",
    });

    const restored = await repository().getDraft(scope, lead);
    expect(restored).toMatchObject({ title: "仅陈明可恢复" });
    await expect(repository().getDraft(scope, developer)).resolves.toBeUndefined();

    if (restored) {
      restored.title = "调用者修改";
    }
    await expect(repository().getDraft(scope, lead)).resolves.toMatchObject({
      title: "仅陈明可恢复",
    });

    await repository().discardDraft(scope, lead);
    await expect(repository().getDraft(scope, lead)).resolves.toBeUndefined();
  });

  it("accepts a valid partial draft but rejects an invalid present field", async () => {
    const repo = repository();

    await expect(repo.saveDraft(scope, developer, {
      templateName: "生成技术方案",
      title: "可逐步保存",
    })).resolves.toMatchObject({ title: "可逐步保存" });

    await expect(repo.saveDraft(scope, developer, {
      priority: 101,
    })).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "VALIDATION"),
    );
  });

  it("submits atomically, removes its draft, increments IDs, and records real transitions", async () => {
    const repo = repository();
    await repo.saveDraft(scope, lead, technicalSolutionDraft);

    const firstTask = await repo.submitTechnicalSolutionTask(scope, lead);
    expect(firstTask).toMatchObject({
      id: "task-mock-0001",
      status: "NEED_APPROVAL",
      templateName: "生成技术方案",
      priority: 50,
      riskLevel: "R1",
    });
    expect(firstTask.history.map(({ toStatus }) => toStatus)).toEqual([
      "DRAFT",
      "READY",
      "PLANNING",
      "NEED_APPROVAL",
    ]);
    await expect(repo.getDraft(scope, lead)).resolves.toBeUndefined();

    firstTask.title = "调用者污染";
    await expect(repo.getTask(scope, lead, "task-mock-0001")).resolves.toMatchObject({
      title: "设计 Task Center 黄金路径",
    });

    await repo.saveDraft(scope, developer, {
      ...technicalSolutionDraft,
      title: "第二个技术方案",
    });
    await expect(repo.submitTechnicalSolutionTask(scope, developer)).resolves.toMatchObject({
      id: "task-mock-0002",
      title: "第二个技术方案",
    });
  });

  it("keeps the draft unchanged when submission validation fails", async () => {
    const repo = repository();
    await repo.saveDraft(scope, productManager, {
      templateName: "生成技术方案",
      title: "未完成草稿",
    });

    await expect(repo.submitTechnicalSolutionTask(scope, productManager)).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "VALIDATION"),
    );
    await expect(repo.getDraft(scope, productManager)).resolves.toMatchObject({
      title: "未完成草稿",
    });
    expect(
      (await repo.listTasks(scope, productManager, { keyword: "未完成草稿" })).total,
    ).toBe(0);
  });

  it("supports keyword, status, template, risk, and every ownership filter", async () => {
    const repo = repository();

    const keyword = await repo.listTasks(scope, lead, {
      keyword: "技术方案",
      pageSize: 20,
    });
    expect(keyword.items.length).toBeGreaterThan(0);
    expect(keyword.items.every((item) =>
      `${item.title}${item.goalSummary}`.includes("技术方案"),
    )).toBe(true);

    const statuses = await repo.listTasks(scope, lead, {
      status: ["NEED_APPROVAL", "REVIEW"],
      pageSize: 20,
    });
    expect(statuses.items.every(({ status }) =>
      status === "NEED_APPROVAL" || status === "REVIEW",
    )).toBe(true);

    const templates = await repo.listTasks(scope, lead, {
      template: "生成技术方案",
      pageSize: 20,
    });
    expect(templates.items.every(({ templateName }) =>
      templateName === "生成技术方案",
    )).toBe(true);

    const risks = await repo.listTasks(scope, lead, {
      risk: ["R1", "R2"],
      pageSize: 20,
    });
    expect(risks.items.every(({ riskLevel }) =>
      riskLevel === "R1" || riskLevel === "R2",
    )).toBe(true);

    for (const ownership of [
      "all",
      "mine",
      "participating",
      "pendingApproval",
      "pendingReview",
    ] as const) {
      const result = await repo.listTasks(scope, lead, {
        ownership,
        pageSize: 20,
      });
      expect(result.total, ownership).toBeGreaterThan(0);
    }
  });

  it("paginates with stable updatedAt descending and ID tie-break ordering", async () => {
    const repo = repository();
    const full = await repo.listTasks(scope, lead, { page: 1, pageSize: 20 });
    const first = await repo.listTasks(scope, lead, { page: 1, pageSize: 4 });
    const second = await repo.listTasks(scope, lead, { page: 2, pageSize: 4 });

    const expectedIds = [...full.items]
      .sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) ||
        left.id.localeCompare(right.id),
      )
      .map(({ id }) => id);
    expect(full.items.map(({ id }) => id)).toEqual(expectedIds);
    expect([...first.items, ...second.items].map(({ id }) => id)).toEqual(
      expectedIds.slice(0, 8),
    );
    expect(first).toMatchObject({ total: 12, page: 1, pageSize: 4 });
  });

  it("uses safe NOT_FOUND errors for unknown and cross-scope Task reads", async () => {
    const repo = repository();
    await expect(repo.getTask(scope, lead, "task-unknown")).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "NOT_FOUND"),
    );
    await expect(repo.getTask(
      { organizationId: "org-guangwei", workspaceId: "ws-other" },
      lead,
      "task-seed-draft",
    )).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "NOT_FOUND"),
    );
  });

  it("returns independent mutable clones from list and get", async () => {
    const repo = repository();
    const firstPage = await repo.listTasks(scope, lead, { pageSize: 20 });
    const taskId = firstPage.items[0].id;
    firstPage.items[0].title = "调用者修改列表";

    const firstDetail = await repo.getTask(scope, lead, taskId);
    const canonicalTitle = firstDetail.title;
    firstDetail.title = "调用者修改详情";
    firstDetail.executionPlan!.steps[0].name = "调用者修改步骤";

    const secondPage = await repo.listTasks(scope, lead, { pageSize: 20 });
    const secondDetail = await repo.getTask(scope, lead, taskId);
    expect(secondPage.items.find(({ id }) => id === taskId)?.title).toBe(canonicalTitle);
    expect(secondDetail.title).toBe(canonicalTitle);
    expect(secondDetail.executionPlan!.steps[0].name).not.toBe("调用者修改步骤");
  });

  it("stores only IDs, form fields, and structured Tasks", async () => {
    const repo = repository();
    await repo.saveDraft(scope, lead, technicalSolutionDraft);
    await repo.submitTechnicalSolutionTask(scope, lead);

    const stored = storage.getItem(TASK_STORE_KEY);
    expect(stored).not.toBeNull();
    expect(stored).not.toMatch(
      /session|password|credential|access.?token|refresh.?token|client.?secret|knowledgeBody/i,
    );
    expect(stored).not.toContain("陈明");
  });

  describe.each([
    ["invalid JSON", "{"],
    [
      "unknown envelope field",
      JSON.stringify({
        schemaVersion: 1,
        nextTaskSequence: 1,
        workspaces: {},
        extra: true,
      }),
    ],
    [
      "bad schema",
      JSON.stringify({
        schemaVersion: 2,
        nextTaskSequence: 1,
        workspaces: {},
      }),
    ],
  ])("invalid persisted store: %s", (_label, storedValue) => {
    it("fails closed, clears storage, and serves seeds on the next call", async () => {
      storage.setItem(TASK_STORE_KEY, storedValue);
      const repo = repository();

      await expect(repo.listTasks(scope, lead, {})).rejects.toSatisfy(
        (error: unknown) => expectRepositoryError(error, "INVALID_STORE"),
      );
      expect(storage.getItem(TASK_STORE_KEY)).toBeNull();
      await expect(repo.listTasks(scope, lead, { pageSize: 20 })).resolves.toMatchObject({
        total: 12,
      });
    });
  });

  it.each([
    ["Auditor draft", (envelope: Record<string, unknown>) => {
      const workspaceStore = getStoredWorkspace(envelope);
      const drafts = workspaceStore.draftsByActor as Record<string, unknown>;
      drafts["user-auditor"] = {
        templateName: "生成技术方案",
        title: "Auditor 不可创建",
      };
    }],
    ["Auditor Task initiator", (envelope: Record<string, unknown>) => {
      const task = getFirstStoredTask(envelope);
      (task.initiator as Record<string, unknown>).userId = "user-auditor";
    }],
    ["invalid status", (envelope: Record<string, unknown>) => {
      const task = getFirstStoredTask(envelope);
      task.status = "RUNNING";
    }],
    ["wrong scope", (envelope: Record<string, unknown>) => {
      const task = getFirstStoredTask(envelope);
      (task.scope as Record<string, unknown>).organizationId = "org-other";
    }],
    ["wrong version ref", (envelope: Record<string, unknown>) => {
      const task = getFirstStoredTask(envelope);
      const refs = task.capabilityVersionRefs as Array<Record<string, unknown>>;
      refs[0].kind = "KNOWLEDGE";
    }],
    ["unknown nested field", (envelope: Record<string, unknown>) => {
      const task = getFirstStoredTask(envelope);
      task.extra = true;
    }],
    ["changed fixed plan step name", (envelope: Record<string, unknown>) => {
      getStoredPlanSteps(envelope)[0].name = "被篡改的步骤";
    }],
    ["changed fixed plan step type", (envelope: Record<string, unknown>) => {
      getStoredPlanSteps(envelope)[1].stepType = "AGENT";
    }],
    ["changed fixed plan step owner", (envelope: Record<string, unknown>) => {
      getStoredPlanSteps(envelope)[3].responsibility = "AI研发员工";
    }],
    ["changed fixed plan step risk", (envelope: Record<string, unknown>) => {
      getStoredPlanSteps(envelope)[2].riskLevel = "R0";
    }],
    ["changed plan scope digest", (envelope: Record<string, unknown>) => {
      const task = getFirstStoredTask(envelope);
      (task.executionPlan as Record<string, unknown>).scopeDigest =
        "sha256:tampered-scope";
    }],
    ["broken history from/to boundary", (envelope: Record<string, unknown>) => {
      getStoredHistory(envelope)[1].fromStatus = "PLANNING";
    }],
    ["non-monotonic history version", (envelope: Record<string, unknown>) => {
      getStoredHistory(envelope)[2].aggregateVersion = 9;
    }],
  ])("clears a structurally invalid store: %s", async (_label, mutate) => {
    const repo = repository();
    await repo.saveDraft(scope, lead, technicalSolutionDraft);
    await repo.submitTechnicalSolutionTask(scope, lead);
    const envelope = JSON.parse(storage.getItem(TASK_STORE_KEY)!) as Record<string, unknown>;
    mutate(envelope);
    storage.setItem(TASK_STORE_KEY, JSON.stringify(envelope));

    await expect(repo.listTasks(scope, lead, {})).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "INVALID_STORE"),
    );
    expect(storage.getItem(TASK_STORE_KEY)).toBeNull();
    await expect(repo.listTasks(scope, lead, { pageSize: 20 })).resolves.toMatchObject({
      total: 12,
    });
  });
});

function getFirstStoredTask(envelope: Record<string, unknown>): Record<string, unknown> {
  const workspaceStore = getStoredWorkspace(envelope);
  const tasks = workspaceStore.createdTasks as Array<Record<string, unknown>>;
  return tasks[0];
}

function getStoredWorkspace(
  envelope: Record<string, unknown>,
): Record<string, unknown> {
  const workspaces = envelope.workspaces as Record<string, Record<string, unknown>>;
  return Object.values(workspaces)[0];
}

function getStoredPlanSteps(
  envelope: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const task = getFirstStoredTask(envelope);
  const plan = task.executionPlan as Record<string, unknown>;
  return plan.steps as Array<Record<string, unknown>>;
}

function getStoredHistory(
  envelope: Record<string, unknown>,
): Array<Record<string, unknown>> {
  return getFirstStoredTask(envelope).history as Array<Record<string, unknown>>;
}
