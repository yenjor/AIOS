import type { DeepReadonly } from "@/types/domain";

import type {
  AgentAssignment,
  ApprovalPoint,
  ArtifactVersionRef,
  CapabilityVersionRef,
  ExecutionPlan,
  ExpectedArtifact,
  KnowledgeVersionRef,
  PlannedTaskDetail,
  TaskActor,
  TaskDetail,
  TaskHistoryItem,
  TaskOwner,
  TaskScope,
  ToolVersionRef,
  WorkflowVersionRef,
} from "../model";
import {
  TASK_TEMPLATE_ARTIFACTS,
  type RiskLevel,
  type TaskStatus,
  type TaskTemplateName,
} from "../task-status";

const fixtureScope: TaskScope = {
  organizationId: "org-guangwei",
  workspaceId: "ws-ai",
};

const agentVersionRef = {
  kind: "AGENT",
  objectId: "agent-rd-001",
  versionId: "agent-rd-001-v1",
  versionNumber: 1,
  digest: "sha256:agent-rd-001-v1",
} as const;

export const technicalSolutionCapabilityVersionRef: DeepReadonly<CapabilityVersionRef> = deepFreeze({
  kind: "CAPABILITY",
  objectId: "capability-technical-solution",
  versionId: "capability-technical-solution-v1",
  versionNumber: 1,
  digest: "sha256:capability-technical-solution-v1",
});

export const aiosKnowledgeVersionRef: DeepReadonly<KnowledgeVersionRef> = deepFreeze({
  kind: "KNOWLEDGE",
  objectId: "knowledge-aios-docs",
  versionId: "knowledge-aios-docs-v1",
  versionNumber: 1,
  digest: "sha256:knowledge-aios-docs-v1",
});

export const readOnlyCodeToolVersionRef: DeepReadonly<ToolVersionRef> = deepFreeze({
  kind: "TOOL",
  objectId: "tool-codegraph-read",
  versionId: "tool-codegraph-read-v1",
  versionNumber: 1,
  digest: "sha256:tool-codegraph-read-v1",
  actionId: "codegraph.context",
  operationType: "READ",
});

const workflowVersionRef: WorkflowVersionRef = {
  kind: "WORKFLOW",
  objectId: "workflow-technical-solution",
  versionId: "workflow-technical-solution-v1",
  versionNumber: 1,
  digest: "sha256:workflow-technical-solution-v1",
};

const assignedAgent: AgentAssignment = {
  agentId: "agent-rd-001",
  agentName: "AI研发员工",
  agentVersionRef: { ...agentVersionRef },
  autonomyLevel: "L1辅助",
  humanOwner: {
    userId: "user-lead",
    displayName: "陈明",
  },
};

const agentOwner: TaskOwner = {
  actorType: "AGENT",
  actorId: "agent-rd-001",
  displayName: "AI研发员工",
};

const expectedTechnicalSolution: ExpectedArtifact = {
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
};

function deepFreeze<T extends object>(value: T): DeepReadonly<T> {
  for (const nestedValue of Object.values(value)) {
    if (
      nestedValue !== null &&
      typeof nestedValue === "object" &&
      !Object.isFrozen(nestedValue)
    ) {
      deepFreeze(nestedValue);
    }
  }

  return Object.freeze(value) as DeepReadonly<T>;
}

function makePlan(taskId: string): ExecutionPlan {
  return {
    versionRef: {
      kind: "PLAN",
      objectId: `plan-${taskId}`,
      versionId: `plan-${taskId}-v1`,
      versionNumber: 1,
      digest: `sha256:plan-${taskId}-v1`,
    },
    goalInterpretation: "在现有 AIOS 架构边界内形成可评审、可实施的技术方案。",
    assumptions: ["现有文档为 Single Source of Truth"],
    missingInformation: [],
    steps: [
      {
        id: `${taskId}-step-01`,
        sequence: 1,
        name: "需求理解与约束确认",
        description: "明确目标、范围、不做事项和验收标准。",
        stepType: "AGENT",
        responsibility: "AI研发员工",
        riskLevel: "R0",
      },
      {
        id: `${taskId}-step-02`,
        sequence: 2,
        name: "代码与模块影响分析",
        description: "只读检索代码结构并识别可能受影响的模块与文件。",
        stepType: "KNOWLEDGE_RETRIEVAL",
        responsibility: "AI研发员工",
        riskLevel: "R0",
      },
      {
        id: `${taskId}-step-03`,
        sequence: 3,
        name: "形成技术方案草稿",
        description: "依据固定 Capability 与知识库版本形成结构化草稿。",
        stepType: "AGENT",
        responsibility: "AI研发员工",
        riskLevel: "R1",
      },
      {
        id: `${taskId}-step-04`,
        sequence: 4,
        name: "方案结构和引用检查",
        description: "检查 Artifact 结构、关键结论和知识库引用。",
        stepType: "VALIDATION",
        responsibility: "Validation",
        riskLevel: "R1",
      },
      {
        id: `${taskId}-step-05`,
        sequence: 5,
        name: "Artifact人工验收",
        description: "由授权 Reviewer 验收技术方案 Artifact。",
        stepType: "HUMAN_REVIEW",
        responsibility: "Reviewer",
        riskLevel: "R1",
      },
    ],
    scopeDigest: `sha256:scope-${taskId}`,
  };
}

function makeApprovalPoints(taskId: string): ApprovalPoint[] {
  return [
    {
      id: `${taskId}-approval-plan`,
      name: "计划确认",
      requiredFor: "PLAN_EXECUTION",
      riskLevel: "R1",
      status: "PENDING",
      reviewerUserIds: ["user-lead"],
    },
    {
      id: `${taskId}-approval-artifact`,
      name: "Artifact验收",
      requiredFor: "ARTIFACT_ACCEPTANCE",
      riskLevel: "R1",
      status: "PENDING",
      reviewerUserIds: ["user-lead"],
    },
  ];
}

const statusPaths: Record<TaskStatus, TaskStatus[]> = {
  DRAFT: ["DRAFT"],
  READY: ["DRAFT", "READY"],
  PLANNING: ["DRAFT", "READY", "PLANNING"],
  NEED_INPUT: ["DRAFT", "READY", "PLANNING", "NEED_INPUT"],
  NEED_APPROVAL: ["DRAFT", "READY", "PLANNING", "NEED_APPROVAL"],
  EXECUTING: ["DRAFT", "READY", "PLANNING", "EXECUTING"],
  PAUSED: ["DRAFT", "READY", "PLANNING", "EXECUTING", "PAUSED"],
  FAILED: ["DRAFT", "READY", "PLANNING", "EXECUTING", "FAILED"],
  REVIEW: ["DRAFT", "READY", "PLANNING", "EXECUTING", "REVIEW"],
  REWORK: [
    "DRAFT",
    "READY",
    "PLANNING",
    "EXECUTING",
    "REVIEW",
    "REWORK",
  ],
  COMPLETED: [
    "DRAFT",
    "READY",
    "PLANNING",
    "EXECUTING",
    "REVIEW",
    "COMPLETED",
  ],
  CANCELLED: ["DRAFT", "CANCELLED"],
};

function makeHistory(
  taskId: string,
  status: TaskStatus,
  actor: TaskActor,
  baseHour: number,
): TaskHistoryItem[] {
  return statusPaths[status].map((toStatus, index, path) => ({
    id: `${taskId}-transition-${String(index + 1).padStart(2, "0")}`,
    fromStatus: index === 0 ? null : path[index - 1],
    toStatus,
    reasonCode: index === 0 ? "TASK_CREATED" : `TASK_${toStatus}`,
    actor: {
      actorType: "USER",
      actorId: actor.userId,
    },
    occurredAt: `2026-07-25T${String(baseHour).padStart(2, "0")}:${String(index).padStart(2, "0")}:00.000Z`,
    aggregateVersion: index + 1,
  }));
}

interface FixtureInput {
  id: string;
  title: string;
  goal: string;
  templateName: TaskTemplateName;
  status: TaskStatus;
  priority: number;
  riskLevel: RiskLevel;
  initiatorId: string;
  updatedAt: string;
  baseHour: number;
  participantUserIds?: string[];
  approverUserIds?: string[];
  reviewerUserIds?: string[];
}

function makeTerminalArtifactRefs(
  taskId: string,
  status: TaskStatus,
  artifactType: ExpectedArtifact["artifactType"],
): ArtifactVersionRef[] {
  if (status === "FAILED" || status === "CANCELLED") {
    return [
      {
        kind: "ARTIFACT",
        objectId: `artifact-execution-summary-${taskId}`,
        versionId: `artifact-execution-summary-${taskId}-v1`,
        versionNumber: 1,
        digest: `sha256:artifact-execution-summary-${taskId}-v1`,
        artifactType: "执行摘要",
        accepted: false,
      },
    ];
  }

  if (status === "COMPLETED") {
    return [
      {
        kind: "ARTIFACT",
        objectId: `artifact-deliverable-${taskId}`,
        versionId: `artifact-deliverable-${taskId}-v1`,
        versionNumber: 1,
        digest: `sha256:artifact-deliverable-${taskId}-v1`,
        artifactType,
        accepted: true,
      },
    ];
  }

  return [];
}

function makeFixture(input: FixtureInput): TaskDetail {
  const expectedArtifact: ExpectedArtifact = {
    artifactType: TASK_TEMPLATE_ARTIFACTS[input.templateName],
    state: "EXPECTED",
    sections:
      input.templateName === "生成技术方案"
        ? [...expectedTechnicalSolution.sections]
        : ["目标与范围", "执行结果", "风险与建议", "知识库引用"],
    knowledgeCitationRequired: true,
  };
  const initiator = { userId: input.initiatorId };
  const hasPlan = input.status !== "DRAFT" && input.status !== "READY";
  const detail: TaskDetail = {
    id: input.id,
    scope: { ...fixtureScope },
    title: input.title,
    goalSummary: input.goal,
    templateName: input.templateName,
    expectedArtifactType: expectedArtifact.artifactType,
    status: input.status,
    priority: input.priority,
    riskLevel: input.riskLevel,
    initiator,
    currentOwner:
      input.status === "EXECUTING" ? { ...agentOwner } : undefined,
    assignedAgentName: hasPlan ? "AI研发员工" : undefined,
    participantUserIds: input.participantUserIds ?? [
      input.initiatorId,
      "user-lead",
    ],
    approverUserIds: input.approverUserIds ?? ["user-lead"],
    reviewerUserIds: input.reviewerUserIds ?? ["user-lead"],
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: input.updatedAt,
    goal: input.goal,
    constraints: ["遵循现有架构与权限边界"],
    outOfScope: ["不执行未授权写入"],
    completionCriteria: [
      `${expectedArtifact.artifactType}符合结构要求`,
      "关键结论包含知识库引用",
      "Artifact 完成人工验收",
    ],
    assignedAgent: hasPlan ? structuredClone(assignedAgent) : undefined,
    capabilityVersionRefs: hasPlan
      ? [structuredClone(technicalSolutionCapabilityVersionRef) as CapabilityVersionRef]
      : [],
    knowledgeVersionRefs: hasPlan
      ? [structuredClone(aiosKnowledgeVersionRef) as KnowledgeVersionRef]
      : [],
    toolVersionRefs: hasPlan
      ? [structuredClone(readOnlyCodeToolVersionRef) as ToolVersionRef]
      : [],
    workflowVersionRef: hasPlan
      ? structuredClone(workflowVersionRef)
      : undefined,
    executionPlan: hasPlan ? makePlan(input.id) : undefined,
    approvalPoints:
      input.status === "NEED_APPROVAL" || input.status === "REVIEW"
        ? makeApprovalPoints(input.id)
        : [],
    expectedArtifact,
    artifactVersionRefs: makeTerminalArtifactRefs(
      input.id,
      input.status,
      expectedArtifact.artifactType,
    ),
    citationRefs: [],
    history: makeHistory(input.id, input.status, initiator, input.baseHour),
    aggregateVersion: statusPaths[input.status].length,
  };

  return detail;
}

export const GOLDEN_TECHNICAL_SOLUTION_TASK_ID =
  "task-golden-technical-solution";

const goldenTask: PlannedTaskDetail = {
  ...makeFixture({
    id: GOLDEN_TECHNICAL_SOLUTION_TASK_ID,
    title: "生成 AIOS Task Center 技术方案",
    goal: "形成可供研发团队评审并实施的 Task Center 技术方案",
    templateName: "生成技术方案",
    status: "NEED_APPROVAL",
    priority: 50,
    riskLevel: "R1",
    initiatorId: "user-pm",
    updatedAt: "2026-07-26T07:50:00.000Z",
    baseHour: 8,
    participantUserIds: ["user-pm", "user-lead", "user-dev"],
    approverUserIds: ["user-lead"],
    reviewerUserIds: ["user-lead"],
  }),
  assignedAgent: structuredClone(assignedAgent),
  workflowVersionRef: structuredClone(workflowVersionRef),
  executionPlan: makePlan(GOLDEN_TECHNICAL_SOLUTION_TASK_ID),
  capabilityVersionRefs: [
    structuredClone(technicalSolutionCapabilityVersionRef) as CapabilityVersionRef,
  ],
  knowledgeVersionRefs: [
    structuredClone(aiosKnowledgeVersionRef) as KnowledgeVersionRef,
  ],
  toolVersionRefs: [
    structuredClone(readOnlyCodeToolVersionRef) as ToolVersionRef,
  ],
  approvalPoints: makeApprovalPoints(GOLDEN_TECHNICAL_SOLUTION_TASK_ID),
  expectedArtifact: structuredClone(expectedTechnicalSolution),
  history: makeHistory(
    GOLDEN_TECHNICAL_SOLUTION_TASK_ID,
    "NEED_APPROVAL",
    { userId: "user-pm" },
    8,
  ),
};

export const goldenTechnicalSolutionTask: DeepReadonly<PlannedTaskDetail> =
  deepFreeze(goldenTask);

const mutableTaskFixtures: TaskDetail[] = [
  makeFixture({
    id: "task-seed-draft",
    title: "整理登录流程重构任务",
    goal: "定义登录流程重构的目标、边界和验收标准",
    templateName: "分析需求",
    status: "DRAFT",
    priority: 70,
    riskLevel: "R0",
    initiatorId: "user-dev",
    updatedAt: "2026-07-25T20:00:00.000Z",
    baseHour: 9,
  }),
  makeFixture({
    id: "task-seed-ready",
    title: "分析商品搜索需求",
    goal: "形成商品搜索功能的需求分析报告",
    templateName: "分析需求",
    status: "READY",
    priority: 45,
    riskLevel: "R1",
    initiatorId: "user-lead",
    updatedAt: "2026-07-25T21:00:00.000Z",
    baseHour: 10,
  }),
  makeFixture({
    id: "task-seed-planning",
    title: "规划订单服务性能优化",
    goal: "形成订单服务性能优化技术方案",
    templateName: "生成技术方案",
    status: "PLANNING",
    priority: 35,
    riskLevel: "R1",
    initiatorId: "user-dev",
    updatedAt: "2026-07-25T22:00:00.000Z",
    baseHour: 11,
  }),
  makeFixture({
    id: "task-seed-need-input",
    title: "补充用户中心接口约束",
    goal: "补齐用户中心改造需求分析所需上下文",
    templateName: "分析需求",
    status: "NEED_INPUT",
    priority: 40,
    riskLevel: "R1",
    initiatorId: "user-pm",
    updatedAt: "2026-07-25T23:00:00.000Z",
    baseHour: 12,
  }),
  goldenTechnicalSolutionTask as TaskDetail,
  makeFixture({
    id: "task-seed-executing",
    title: "执行支付模块辅助编码",
    goal: "在已批准范围内形成代码变更",
    templateName: "辅助编码",
    status: "EXECUTING",
    priority: 20,
    riskLevel: "R2",
    initiatorId: "user-dev",
    updatedAt: "2026-07-26T07:40:00.000Z",
    baseHour: 13,
  }),
  makeFixture({
    id: "task-seed-paused",
    title: "暂停知识权限检查",
    goal: "完成代码理解报告前复核知识库权限",
    templateName: "理解代码",
    status: "PAUSED",
    priority: 30,
    riskLevel: "R1",
    initiatorId: "user-admin",
    updatedAt: "2026-07-26T07:30:00.000Z",
    baseHour: 14,
  }),
  makeFixture({
    id: "task-seed-failed",
    title: "定位自动测试执行失败",
    goal: "形成失败摘要并确定安全重规划路径",
    templateName: "自动测试",
    status: "FAILED",
    priority: 10,
    riskLevel: "R2",
    initiatorId: "user-dev",
    updatedAt: "2026-07-26T07:20:00.000Z",
    baseHour: 15,
  }),
  makeFixture({
    id: "task-seed-review",
    title: "验收支付模块自动测试报告",
    goal: "审查自动测试报告并作出 Artifact 验收决定",
    templateName: "自动测试",
    status: "REVIEW",
    priority: 25,
    riskLevel: "R1",
    initiatorId: "user-dev",
    updatedAt: "2026-07-26T07:10:00.000Z",
    baseHour: 16,
    reviewerUserIds: ["user-lead"],
  }),
  makeFixture({
    id: "task-seed-rework",
    title: "返工订单服务技术方案",
    goal: "依据 Reviewer 反馈修订订单服务技术方案",
    templateName: "生成技术方案",
    status: "REWORK",
    priority: 15,
    riskLevel: "R2",
    initiatorId: "user-lead",
    updatedAt: "2026-07-26T07:00:00.000Z",
    baseHour: 17,
  }),
  makeFixture({
    id: "task-seed-completed",
    title: "完成认证模块代码理解报告",
    goal: "沉淀认证模块结构和关键调用关系",
    templateName: "理解代码",
    status: "COMPLETED",
    priority: 50,
    riskLevel: "R0",
    initiatorId: "user-dev",
    updatedAt: "2026-07-26T06:50:00.000Z",
    baseHour: 18,
  }),
  makeFixture({
    id: "task-seed-cancelled",
    title: "取消遗留模块 Code Review",
    goal: "停止已不再需要的遗留模块审查",
    templateName: "Code Review",
    status: "CANCELLED",
    priority: 90,
    riskLevel: "R3",
    initiatorId: "user-admin",
    updatedAt: "2026-07-26T06:40:00.000Z",
    baseHour: 19,
  }),
];

export const taskFixtures: readonly DeepReadonly<TaskDetail>[] = deepFreeze(
  mutableTaskFixtures,
);
