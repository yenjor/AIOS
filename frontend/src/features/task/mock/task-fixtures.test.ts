import { describe, expect, expectTypeOf, it } from "vitest";

import type { DeepReadonly } from "@/types/domain";
import type { PlannedTaskDetail, TaskDetail } from "../model";
import { TASK_STATUSES } from "../task-status";
import {
  GOLDEN_TECHNICAL_SOLUTION_TASK_ID,
  aiosKnowledgeVersionRef,
  goldenTechnicalSolutionTask,
  readOnlyCodeToolVersionRef,
  taskFixtures,
  technicalSolutionCapabilityVersionRef,
} from "./task-fixtures";

const forbiddenKeyNames = new Set([
  "apikey",
  "accesstoken",
  "authorization",
  "clientsecret",
  "credential",
  "password",
  "privatekey",
  "refreshtoken",
  "secret",
  "token",
]);

function expectTreeFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") {
    return;
  }

  expect(Object.isFrozen(value)).toBe(true);
  Object.values(value).forEach(expectTreeFrozen);
}

function expectNoSecrets(value: unknown): void {
  if (typeof value === "string") {
    expect(value).not.toMatch(/^sk-[a-z0-9_-]+/i);
    expect(value).not.toMatch(/-----BEGIN .* PRIVATE KEY-----/i);
    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    expect(forbiddenKeyNames).not.toContain(
      key.replace(/[ _-]/g, "").toLowerCase(),
    );
    expectNoSecrets(nestedValue);
  }
}

describe("任务 fixtures", () => {
  it("are deeply readonly by type and recursively frozen at runtime", () => {
    expectTypeOf(taskFixtures).toEqualTypeOf<
      readonly DeepReadonly<TaskDetail>[]
    >();
    expectTypeOf(goldenTechnicalSolutionTask).toEqualTypeOf<
      DeepReadonly<PlannedTaskDetail>
    >();

    expectTreeFrozen(taskFixtures);
    expectTreeFrozen(goldenTechnicalSolutionTask);
    expectTreeFrozen(technicalSolutionCapabilityVersionRef);
    expectTreeFrozen(aiosKnowledgeVersionRef);
    expectTreeFrozen(readOnlyCodeToolVersionRef);
  });

  it("contains a representative 任务 for each canonical status", () => {
    expect(taskFixtures).toHaveLength(12);
    expect(new Set(taskFixtures.map(({ status }) => status))).toEqual(
      new Set(TASK_STATUSES),
    );
    expect(taskFixtures.every((task) => task.scope.organizationId === "org-guangwei")).toBe(true);
    expect(taskFixtures.every((task) => task.scope.workspaceId === "ws-ai")).toBe(true);
    expect(new Set(taskFixtures.map(({ id }) => id)).size).toBe(12);
  });

  it("defines the approved golden technical-solution 任务 without a fake 成果", () => {
    expect(goldenTechnicalSolutionTask).toMatchObject({
      id: GOLDEN_TECHNICAL_SOLUTION_TASK_ID,
      templateName: "生成技术方案",
      status: "NEED_APPROVAL",
      priority: 50,
      riskLevel: "R1",
      assignedAgent: {
        agentId: "agent-rd-001",
        agentName: "AI 研发员工",
        autonomyLevel: "L1辅助",
        humanOwner: {
          userId: "user-lead",
          displayName: "陈明",
        },
      },
      expectedArtifact: {
        artifactType: "技术方案",
        state: "EXPECTED",
        knowledgeCitationRequired: true,
      },
    });

    expect(goldenTechnicalSolutionTask.executionPlan.steps).toEqual([
      expect.objectContaining({
        sequence: 1,
        name: "需求理解与约束确认",
        riskLevel: "R0",
      }),
      expect.objectContaining({
        sequence: 2,
        name: "代码与模块影响分析",
        riskLevel: "R0",
      }),
      expect.objectContaining({
        sequence: 3,
        name: "形成技术方案草稿",
        riskLevel: "R1",
      }),
      expect.objectContaining({
        sequence: 4,
        name: "方案结构和引用检查",
        responsibility: "验证",
        riskLevel: "R1",
      }),
      expect.objectContaining({
        sequence: 5,
        name: "成果人工验收",
        responsibility: "验收人",
      }),
    ]);
    expect(goldenTechnicalSolutionTask.approvalPoints.map(({ name }) => name)).toEqual([
      "计划确认",
      "成果验收",
    ]);
    expect(goldenTechnicalSolutionTask.expectedArtifact.sections).toEqual([
      "目标理解",
      "范围与不做事项",
      "影响模块与文件",
      "技术决策",
      "风险",
      "测试建议",
      "回退考虑",
      "知识库引用",
    ]);
    expect(goldenTechnicalSolutionTask.artifactVersionRefs).toEqual([]);
  });

  it("使用固定的能力、知识库和只读工具版本引用", () => {
    expect(goldenTechnicalSolutionTask.capabilityVersionRefs).toHaveLength(1);
    expect(goldenTechnicalSolutionTask.knowledgeVersionRefs).toHaveLength(1);
    expect(goldenTechnicalSolutionTask.toolVersionRefs).toEqual([
      expect.objectContaining({
        kind: "TOOL",
        operationType: "READ",
      }),
    ]);
  });

  it("records only the four 任务 transitions that really occurred", () => {
    expect(goldenTechnicalSolutionTask.history.map(({ toStatus }) => toStatus)).toEqual([
      "DRAFT",
      "READY",
      "PLANNING",
      "NEED_APPROVAL",
    ]);
  });

  it("associates required 成果 evidence with terminal 任务 fixtures", () => {
    const failed = taskFixtures.find(({ status }) => status === "FAILED");
    const cancelled = taskFixtures.find(({ status }) => status === "CANCELLED");
    const completed = taskFixtures.find(({ status }) => status === "COMPLETED");

    expect(failed?.artifactVersionRefs).toEqual([
      expect.objectContaining({
        kind: "ARTIFACT",
        artifactType: "执行摘要",
        accepted: false,
      }),
    ]);
    expect(cancelled?.artifactVersionRefs).toEqual([
      expect.objectContaining({
        kind: "ARTIFACT",
        artifactType: "执行摘要",
        accepted: false,
      }),
    ]);
    expect(completed?.artifactVersionRefs).toEqual([
      expect.objectContaining({
        kind: "ARTIFACT",
        artifactType: "代码理解报告",
        accepted: true,
      }),
    ]);
  });

  it("contains no credential-like key or value", () => {
    expectNoSecrets([
      taskFixtures,
      goldenTechnicalSolutionTask,
      technicalSolutionCapabilityVersionRef,
      aiosKnowledgeVersionRef,
      readOnlyCodeToolVersionRef,
    ]);
  });
});
