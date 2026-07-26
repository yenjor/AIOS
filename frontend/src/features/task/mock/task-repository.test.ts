import { beforeEach, describe, expect, it } from "vitest";

import type {
  RuntimeStepResult,
  TaskActor,
  TaskDraft,
  TaskPermissionDecision,
  TaskScope,
} from "../model";
import { TASK_STATUSES } from "../task-status";
import * as taskRepositoryModule from "./task-repository";
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

type PermissionQuery = (
  scope: TaskScope,
  actor: TaskActor,
) => Promise<TaskPermissionDecision>;

const technicalSolutionDraft: TaskDraft & {
  wizardStep: 5;
  currentProblem: string;
  workScope: string;
  expectedCompletionAt: string;
} = {
  wizardStep: 5,
  currentProblem: "当前 Task 创建流程缺少可恢复的业务问题上下文",
  workScope: "Task Center 创建向导与提交结果映射",
  expectedCompletionAt: "2026-08-15T10:30:00.000Z",
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
      "知识库引用",
    ],
    knowledgeCitationRequired: true,
  },
  completionCriteria: [
    "技术方案包含约定的全部章节",
    "关键判断包含知识库引用",
    "由人类 Reviewer 完成 Artifact 验收",
  ],
};

function runtimeStepResult(
  taskId: string,
  sequence: 1 | 2 | 3 | 4,
): RuntimeStepResult {
  const stepId = `${taskId}-step-${String(sequence).padStart(2, "0")}`;
  const baseResult = {
    stepId,
    summary: `确定性 Runtime 已完成第 ${sequence} 步。`,
    outputReference: `run-${taskId}-step-${String(sequence).padStart(2, "0")}-output`,
    outputDigest: `sha256:execution-package-${taskId}-v1:step-${sequence}`,
  };

  if (sequence !== 4) {
    return {
      ...baseResult,
      resultType: "STEP_SUCCEEDED",
    };
  }

  const artifactId = `artifact-${taskId}`;
  return {
    ...baseResult,
    resultType: "ARTIFACT_DRAFT",
    outputReference: `artifact-draft-${taskId}`,
    artifactVersionRef: {
      kind: "ARTIFACT",
      objectId: artifactId,
      versionId: `${artifactId}-v1`,
      versionNumber: 1,
      digest: `sha256:${artifactId}-v1`,
      artifactType: "技术方案",
      accepted: false,
    },
    citationRefs: [
      {
        knowledgeVersionRef: {
          kind: "KNOWLEDGE",
          objectId: "knowledge-aios-docs",
          versionId: "knowledge-aios-docs-v1",
          versionNumber: 1,
          digest: "sha256:knowledge-aios-docs-v1",
        },
        locator: "README.md#5-系统整体架构",
        digest:
          "sha256:citation:knowledge-aios-docs-v1:readme-architecture",
      },
    ],
  };
}

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
    await expect(
      repo.approveTaskPlan(scope, auditor, "task-seed-need-approval"),
    ).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "FORBIDDEN"),
    );
    await expect(
      repo.recordExecutionStep(
        scope,
        auditor,
        "task-seed-executing",
        runtimeStepResult("task-seed-executing", 1),
      ),
    ).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "FORBIDDEN"),
    );
    await expect(
      repo.recordArtifactAcceptance(
        scope,
        auditor,
        "task-seed-review",
        "artifact-task-seed-review-v1",
      ),
    ).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "FORBIDDEN"),
    );
  });

  it("persists the first AI employee approval, execution, review, and completion lifecycle", async () => {
    const repo = repository();
    await repo.saveDraft(scope, productManager, technicalSolutionDraft);
    const submitted = await repo.submitTechnicalSolutionTask(
      scope,
      productManager,
    );

    await expect(
      repo.approveTaskPlan(scope, productManager, submitted.id),
    ).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "FORBIDDEN"),
    );

    const executing = await repo.approveTaskPlan(
      scope,
      lead,
      submitted.id,
    );
    expect(executing).toMatchObject({
      status: "EXECUTING",
      currentOwner: {
        actorType: "AGENT",
        actorId: "agent-rd-001",
      },
      executionRun: {
        id: `run-${submitted.id}-01`,
        status: "RUNNING",
        currentStepId: `${submitted.id}-step-01`,
        workerPool: "agent-reasoning",
      },
    });
    expect(executing.approvalPoints[0].status).toBe("APPROVED");
    expect(executing.history.at(-1)?.actor).toEqual({
      actorType: "USER",
      actorId: "user-lead",
    });

    await expect(
      repo.recordExecutionStep(
        scope,
        productManager,
        submitted.id,
        runtimeStepResult(submitted.id, 1),
      ),
    ).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "FORBIDDEN"),
    );
    await expect(
      repo.recordExecutionStep(
        scope,
        lead,
        submitted.id,
        runtimeStepResult(submitted.id, 2),
      ),
    ).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "VALIDATION"),
    );

    for (const sequence of [1, 2, 3] as const) {
      const progressed = await repo.recordExecutionStep(
        scope,
        lead,
        submitted.id,
        runtimeStepResult(submitted.id, sequence),
      );
      expect(progressed.executionRun?.checkpoints).toHaveLength(sequence);
      expect(progressed.executionRun?.currentStepId).toBe(
        `${submitted.id}-step-${String(sequence + 1).padStart(2, "0")}`,
      );
    }

    const review = await repo.recordExecutionStep(
      scope,
      lead,
      submitted.id,
      runtimeStepResult(submitted.id, 4),
    );
    expect(review).toMatchObject({
      status: "REVIEW",
      currentOwner: {
        actorType: "USER",
        actorId: "user-lead",
      },
      executionRun: {
        status: "SUCCEEDED",
      },
    });
    expect(review.executionRun?.checkpoints).toHaveLength(4);
    expect(review.executionRun?.steps[4]).toMatchObject({
      status: "WAITING_HUMAN",
      resultType: "HUMAN_REVIEW",
    });
    expect(review.artifactVersionRefs[0]).toMatchObject({
      objectId: `artifact-${submitted.id}`,
      accepted: false,
    });
    expect(review.citationRefs[0].locator).toBe(
      "README.md#5-系统整体架构",
    );
    expect(review.history.at(-1)?.actor).toEqual({
      actorType: "AGENT",
      actorId: "agent-rd-001",
    });

    await expect(
      repo.recordArtifactAcceptance(
        scope,
        productManager,
        submitted.id,
        `artifact-${submitted.id}-v1`,
      ),
    ).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "FORBIDDEN"),
    );

    const completed = await repo.recordArtifactAcceptance(
      scope,
      lead,
      submitted.id,
      `artifact-${submitted.id}-v1`,
    );
    expect(completed).toMatchObject({
      status: "COMPLETED",
      aggregateVersion: 7,
    });
    expect(completed.currentOwner).toBeUndefined();
    expect(completed.executionRun?.steps[4]).toMatchObject({
      status: "SUCCEEDED",
      resultType: "HUMAN_REVIEW",
    });
    expect(completed.approvalPoints.map(({ status }) => status)).toEqual([
      "APPROVED",
      "APPROVED",
    ]);
    expect(completed.artifactVersionRefs[0].accepted).toBe(true);
    expect(completed.history.at(-1)?.actor).toEqual({
      actorType: "USER",
      actorId: "user-lead",
    });

    await expect(
      repository().getTask(scope, lead, submitted.id),
    ).resolves.toEqual(completed);
  });

  it.each([
    ["user-pm", true],
    ["user-dev", true],
    ["user-lead", true],
    ["user-admin", true],
    ["user-auditor", false],
  ] as const)(
    "exposes the readonly permission decision for %s",
    async (userId, expectedAllowed) => {
      const permissionModule = taskRepositoryModule as typeof taskRepositoryModule & {
        getTaskPermission: PermissionQuery;
      };
      const decision = await permissionModule.getTaskPermission(scope, { userId });

      expect(decision).toMatchObject({
        allowed: expectedAllowed,
        code: expectedAllowed ? "ALLOWED" : "FORBIDDEN",
      });
      decision.reason = "调用者可安全修改返回值";

      const repeated = await permissionModule.getTaskPermission(scope, { userId });
      expect(repeated.reason).not.toBe("调用者可安全修改返回值");
    },
  );

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
    await expect(repo.getDraft(scope, developer)).resolves.toMatchObject({
      templateName: "生成技术方案",
      title: "可逐步保存",
    });
  });

  it("round-trips Task wizard metadata losslessly, overwrites later saves, and preserves actor isolation", async () => {
    const repo = repository();
    const firstInput = {
      wizardStep: 2,
      currentProblem: "需要持久化向导业务问题",
      workScope: "Task 创建向导前两步",
      expectedCompletionAt: "2026-08-01T09:00:00.000Z",
    };

    const firstSaved = await repo.saveDraft(
      scope,
      lead,
      firstInput as TaskDraft,
    );
    expect(firstSaved).toEqual({
      ...firstInput,
      updatedAt: "2026-07-26T08:00:00.000Z",
    });
    await expect(repository().getDraft(scope, lead)).resolves.toEqual(
      firstSaved,
    );

    const changed = {
      wizardStep: 3,
      currentProblem: "更新后的业务问题",
      workScope: "Task 创建向导前三步",
      expectedCompletionAt: "2026-08-02T09:00:00.000Z",
    };
    const overwritten = await repo.saveDraft(
      scope,
      lead,
      changed as TaskDraft,
    );
    expect(overwritten).toEqual({
      ...changed,
      updatedAt: "2026-07-26T08:00:00.000Z",
    });
    await expect(repo.getDraft(scope, lead)).resolves.toEqual(overwritten);
    await expect(repo.getDraft(scope, developer)).resolves.toBeUndefined();
  });

  it("replaces a rich Task draft with the caller's minimal snapshot and clears every omitted field", async () => {
    const repo = repository();
    await repo.saveDraft(scope, lead, {
      title: "旧标题",
      goal: "旧目标",
      capabilityVersionRefs: technicalSolutionDraft.capabilityVersionRefs,
      knowledgeVersionRefs: technicalSolutionDraft.knowledgeVersionRefs,
      toolVersionRefs: technicalSolutionDraft.toolVersionRefs,
      assignedAgent: technicalSolutionDraft.assignedAgent,
    });

    const minimalSnapshot: TaskDraft = {
      currentProblem: "只保留当前问题",
    };
    const replaced = await repo.saveDraft(
      scope,
      lead,
      minimalSnapshot,
    );

    expect(replaced).toEqual({
      currentProblem: "只保留当前问题",
      updatedAt: "2026-07-26T08:00:00.000Z",
    });
    await expect(repo.getDraft(scope, lead)).resolves.toEqual(replaced);
    expect(replaced).not.toHaveProperty("title");
    expect(replaced).not.toHaveProperty("goal");
    expect(replaced).not.toHaveProperty("capabilityVersionRefs");
    expect(replaced).not.toHaveProperty("knowledgeVersionRefs");
    expect(replaced).not.toHaveProperty("toolVersionRefs");
    expect(replaced).not.toHaveProperty("assignedAgent");
  });

  it("clears golden-template bindings when a non-golden Task draft snapshot replaces them", async () => {
    const repo = repository();
    await repo.saveDraft(scope, lead, technicalSolutionDraft);

    const nonGoldenSnapshot: TaskDraft = {
      wizardStep: 1,
      currentProblem: "分析新的业务需求",
      workScope: "需求分析范围",
      expectedCompletionAt: "2026-08-20T10:00:00.000Z",
      templateName: "分析需求",
      title: "新的需求分析 Task",
    };
    const replaced = await repo.saveDraft(
      scope,
      lead,
      nonGoldenSnapshot,
    );

    expect(replaced).toEqual({
      ...nonGoldenSnapshot,
      updatedAt: "2026-07-26T08:00:00.000Z",
    });
    expect(replaced).not.toHaveProperty("capabilityVersionRefs");
    expect(replaced).not.toHaveProperty("knowledgeVersionRefs");
    expect(replaced).not.toHaveProperty("toolVersionRefs");
    expect(replaced).not.toHaveProperty("assignedAgent");
    expect(replaced).not.toHaveProperty("expectedArtifact");
    expect(replaced).not.toHaveProperty("completionCriteria");
    await expect(repository().getDraft(scope, lead)).resolves.toEqual(
      replaced,
    );
  });

  it.each([
    ["wizard step below range", { wizardStep: 0 }],
    ["wizard step above range", { wizardStep: 6 }],
    ["fractional wizard step", { wizardStep: 2.5 }],
    ["string wizard step", { wizardStep: "2" }],
    ["blank current problem", { currentProblem: "   " }],
    ["blank work scope", { workScope: "\t" }],
    ["invalid completion timestamp", { expectedCompletionAt: "2026-08-01" }],
  ])("rejects invalid Task wizard metadata: %s", async (_label, value) => {
    await expect(
      repository().saveDraft(scope, lead, value as unknown as TaskDraft),
    ).rejects.toSatisfy(
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
      goalSummary: technicalSolutionDraft.currentProblem,
    });
    expect(firstTask.constraints).toEqual([
      ...technicalSolutionDraft.constraints!,
      `工作范围：${technicalSolutionDraft.workScope}`,
      `期望完成时间：${technicalSolutionDraft.expectedCompletionAt}`,
    ]);
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

  it.each([
    ["wizardStep", 4],
    ["currentProblem", undefined],
    ["workScope", undefined],
    ["expectedCompletionAt", undefined],
  ] as const)(
    "requires final wizard metadata before submission: %s",
    async (field, value) => {
      const incomplete = structuredClone(technicalSolutionDraft) as
        TaskDraft & Record<string, unknown>;
      if (value === undefined) {
        delete incomplete[field];
      } else {
        incomplete[field] = value;
      }
      const repo = repository();
      await repo.saveDraft(scope, lead, incomplete);

      await expect(
        repo.submitTechnicalSolutionTask(scope, lead),
      ).rejects.toSatisfy(
        (error: unknown) => expectRepositoryError(error, "VALIDATION"),
      );
      await expect(repo.getDraft(scope, lead)).resolves.toBeDefined();
    },
  );

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

    const mine = await repo.listTasks(scope, lead, {
      ownership: "mine",
      pageSize: 20,
    });
    expect(mine.total).toBeGreaterThan(0);
    expect(mine.items.every((task) =>
      task.initiator.userId === lead.userId ||
      (task.currentOwner?.actorType === "USER" &&
        task.currentOwner.actorId === lead.userId),
    )).toBe(true);

    const participating = await repo.listTasks(scope, lead, {
      ownership: "participating",
      pageSize: 20,
    });
    expect(participating.total).toBeGreaterThan(0);
    expect(participating.items.every((task) =>
      task.participantUserIds.includes(lead.userId),
    )).toBe(true);

    const pendingApproval = await repo.listTasks(scope, lead, {
      ownership: "pendingApproval",
      pageSize: 20,
    });
    expect(pendingApproval.total).toBeGreaterThan(0);
    expect(pendingApproval.items.every((task) =>
      task.status === "NEED_APPROVAL" &&
      task.approverUserIds.includes(lead.userId),
    )).toBe(true);

    const pendingReview = await repo.listTasks(scope, lead, {
      ownership: "pendingReview",
      pageSize: 20,
    });
    expect(pendingReview.total).toBeGreaterThan(0);
    expect(pendingReview.items.every((task) =>
      task.status === "REVIEW" &&
      task.reviewerUserIds.includes(lead.userId),
    )).toBe(true);

    for (const ownership of [
      "mine",
      "participating",
      "pendingApproval",
      "pendingReview",
    ] as const) {
      await expect(repo.listTasks(scope, auditor, {
        ownership,
        pageSize: 20,
      })).resolves.toMatchObject({ total: 0 });
    }
  });

  it("normalizes malformed public scope and actor inputs to typed errors", async () => {
    const repo = repository();

    for (const malformedScope of [
      null,
      {},
      { organizationId: "org-guangwei" },
    ]) {
      await expect(
        repo.listTasks(malformedScope as TaskScope, lead, {}),
      ).rejects.toSatisfy(
        (error: unknown) => expectRepositoryError(error, "VALIDATION"),
      );
    }

    for (const malformedActor of [null, {}, { userId: 7 }]) {
      await expect(
        repo.getDraft(scope, malformedActor as unknown as TaskActor),
      ).rejects.toSatisfy(
        (error: unknown) => expectRepositoryError(error, "VALIDATION"),
      );
    }
  });

  it.each([
    null,
    { assignedAgent: null },
    {
      assignedAgent: {
        agentId: "agent-rd-001",
        agentName: "AI研发员工",
        agentVersionRef: null,
        autonomyLevel: "L1辅助",
        humanOwner: {
          userId: "user-lead",
          displayName: "陈明",
        },
      },
    },
    {
      assignedAgent: {
        agentId: "agent-rd-001",
        agentName: "AI研发员工",
        agentVersionRef: technicalSolutionDraft.assignedAgent?.agentVersionRef,
        autonomyLevel: "L1辅助",
        humanOwner: null,
      },
    },
  ])("normalizes a malformed draft boundary: %#", async (malformedDraft) => {
    await expect(
      repository().saveDraft(
        scope,
        lead,
        malformedDraft as unknown as TaskDraft,
      ),
    ).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "VALIDATION"),
    );
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
    ["invalid wizard step", (draft: Record<string, unknown>) => {
      draft.wizardStep = 6;
    }],
    ["blank current problem", (draft: Record<string, unknown>) => {
      draft.currentProblem = " ";
    }],
    ["invalid completion timestamp", (draft: Record<string, unknown>) => {
      draft.expectedCompletionAt = "not-a-timestamp";
    }],
  ])("clears persisted invalid Task wizard metadata: %s", async (_label, mutate) => {
    const repo = repository();
    await repo.saveDraft(scope, lead, technicalSolutionDraft);
    const envelope = JSON.parse(storage.getItem(TASK_STORE_KEY)!) as Record<
      string,
      unknown
    >;
    mutate(getStoredDraft(envelope, lead.userId));
    storage.setItem(TASK_STORE_KEY, JSON.stringify(envelope));

    await expect(repo.getDraft(scope, lead)).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "INVALID_STORE"),
    );
    expect(storage.getItem(TASK_STORE_KEY)).toBeNull();
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
    ["changed plan goal interpretation", (envelope: Record<string, unknown>) => {
      const task = getFirstStoredTask(envelope);
      (task.executionPlan as Record<string, unknown>).goalInterpretation =
        "被篡改的目标解释";
    }],
    ["changed plan assumptions", (envelope: Record<string, unknown>) => {
      const task = getFirstStoredTask(envelope);
      (task.executionPlan as Record<string, unknown>).assumptions = [
        "被篡改的假设",
      ];
    }],
    ["changed plan missing information", (envelope: Record<string, unknown>) => {
      const task = getFirstStoredTask(envelope);
      (task.executionPlan as Record<string, unknown>).missingInformation = [
        "被篡改的缺失项",
      ];
    }],
    ["changed plan step description", (envelope: Record<string, unknown>) => {
      getStoredPlanSteps(envelope)[4].description = "被篡改的步骤说明";
    }],
    ["approved plan point", (envelope: Record<string, unknown>) => {
      getStoredApprovalPoints(envelope)[0].status = "APPROVED";
    }],
    ["duplicate approval point ID", (envelope: Record<string, unknown>) => {
      const points = getStoredApprovalPoints(envelope);
      points[1].id = points[0].id;
    }],
    ["mismatched approval point pair", (envelope: Record<string, unknown>) => {
      getStoredApprovalPoints(envelope)[0].requiredFor =
        "ARTIFACT_ACCEPTANCE";
    }],
    ["changed approval risk", (envelope: Record<string, unknown>) => {
      getStoredApprovalPoints(envelope)[1].riskLevel = "R0";
    }],
    ["changed approval reviewer", (envelope: Record<string, unknown>) => {
      getStoredApprovalPoints(envelope)[1].reviewerUserIds = ["user-dev"];
    }],
    ["broken history from/to boundary", (envelope: Record<string, unknown>) => {
      getStoredHistory(envelope)[1].fromStatus = "PLANNING";
    }],
    ["non-monotonic history version", (envelope: Record<string, unknown>) => {
      getStoredHistory(envelope)[2].aggregateVersion = 9;
    }],
    ["invalid createdAt", (envelope: Record<string, unknown>) => {
      getFirstStoredTask(envelope).createdAt = "not-a-date";
    }],
    ["updatedAt before createdAt", (envelope: Record<string, unknown>) => {
      getFirstStoredTask(envelope).updatedAt = "2026-07-25T00:00:00.000Z";
    }],
    ["history before Task creation", (envelope: Record<string, unknown>) => {
      getStoredHistory(envelope)[0].occurredAt = "2026-07-25T00:00:00.000Z";
    }],
    ["history after Task update", (envelope: Record<string, unknown>) => {
      getStoredHistory(envelope)[3].occurredAt = "2099-01-01T00:00:00.000Z";
    }],
    [
      "duplicate numeric sequence via noncanonical Task ID",
      (envelope: Record<string, unknown>) => {
        const workspaceStore = getStoredWorkspace(envelope);
        const tasks = workspaceStore.createdTasks as Array<
          Record<string, unknown>
        >;
        const canonicalId = String(tasks[0].id);
        const noncanonicalId = "task-mock-00001";
        const duplicate = JSON.parse(
          JSON.stringify(tasks[0]).replaceAll(canonicalId, noncanonicalId),
        ) as Record<string, unknown>;
        tasks.push(duplicate);
      },
    ],
    ["unsafe next sequence", (envelope: Record<string, unknown>) => {
      envelope.nextTaskSequence = Number.MAX_SAFE_INTEGER + 1;
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

function getStoredDraft(
  envelope: Record<string, unknown>,
  actorId: string,
): Record<string, unknown> {
  const workspaceStore = getStoredWorkspace(envelope);
  const drafts = workspaceStore.draftsByActor as Record<
    string,
    Record<string, unknown>
  >;
  return drafts[actorId];
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

function getStoredApprovalPoints(
  envelope: Record<string, unknown>,
): Array<Record<string, unknown>> {
  return getFirstStoredTask(envelope).approvalPoints as Array<
    Record<string, unknown>
  >;
}
