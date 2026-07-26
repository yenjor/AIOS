import type {
  RuntimeStepResult,
  TaskDetail,
} from "@/features/task/model";
import type {
  ArtifactSection,
  TechnicalSolutionArtifactDraft,
} from "@/features/artifact/model";

export class MockAgentRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MockAgentRuntimeError";
  }
}

export interface MockAgentRuntimeOutput {
  stepResult: RuntimeStepResult;
  artifactDraft?: TechnicalSolutionArtifactDraft;
}

const RUNTIME_STEP_SUMMARIES: Readonly<Record<number, string>> = {
  1: "已在 Task Goal、Constraints、Completion Criteria 与 Scope Digest 内确认执行边界。",
  2: "已通过固定知识库版本与只读 ToolVersion 完成授权资料检索，并保留引用证据。",
  3: "已依据固定 CapabilityVersion 与 WorkflowVersion 形成结构化技术方案草稿。",
  4: "已完成八个必需章节、知识库引用与 Reviewer 门禁检查。",
};

function normalizeList(values: readonly string[]): string {
  return values.length > 0 ? values.join("；") : "未提供";
}

function buildSections(task: TaskDetail): ArtifactSection[] {
  return [
    {
      title: "目标理解",
      paragraphs: [
        task.goal,
        `当前问题：${task.goalSummary}`,
        "本次结果由确定性 Mock Agent Runtime 生成，用于验证 AIOS 执行契约；未调用外部模型。",
      ],
    },
    {
      title: "范围与不做事项",
      paragraphs: [
        `约束：${normalizeList(task.constraints)}`,
        `不做事项：${normalizeList(task.outOfScope)}`,
      ],
    },
    {
      title: "影响模块与文件",
      paragraphs: [
        "影响分析限定在 Task 声明范围内，重点覆盖 Task Center、创建向导、详情 Read Model 与受控执行交互。",
        "只读 Tool Action 为 codegraph.context；当前 Mock Runtime 不执行代码写入、命令执行或外部系统变更。",
      ],
    },
    {
      title: "技术决策",
      paragraphs: [
        "Task 保持核心协调入口，运行期仅使用已固定的 Agent、Capability、知识库、Workflow 与 Tool VersionRef。",
        "每次只推进一个有界 Step，并在步骤完成后保存 WorkflowCheckpoint。",
        "Artifact 作为独立对象进入人工验收；Agent Runtime 不直接把 Task 标记为 Completed。",
      ],
    },
    {
      title: "风险",
      paragraphs: [
        `当前 Task 风险等级为 ${task.riskLevel}，自治等级为 ${task.assignedAgent?.autonomyLevel ?? "未分配"}。`,
        "Mock Runtime 只生成候选 Artifact，不使用写入型 Tool，不扩大 Workspace 权限。",
      ],
    },
    {
      title: "测试建议",
      paragraphs: task.completionCriteria.map(
        (criterion) => `验证：${criterion}`,
      ),
    },
    {
      title: "回退考虑",
      paragraphs: [
        "本次执行无外部副作用；验收前可拒绝 Artifact 并返回返工路径。",
        "运行证据和状态转换只追加，禁止通过覆盖历史伪造回退。",
      ],
    },
    {
      title: "知识库引用",
      paragraphs: task.knowledgeVersionRefs.map(
        (reference) =>
          `${reference.versionId} · ${reference.digest} · locator: README.md#5-系统整体架构`,
      ),
    },
  ];
}

function packageDigest(task: TaskDetail): string {
  const run = task.executionRun;
  if (!run) {
    throw new MockAgentRuntimeError("ExecutionRun is required.");
  }
  return run.executionPackageDigest;
}

export function executeNextTechnicalSolutionStep(
  task: TaskDetail,
): MockAgentRuntimeOutput {
  if (
    task.status !== "EXECUTING" ||
    !task.executionRun ||
    task.executionRun.status !== "RUNNING" ||
    !task.executionPlan ||
    !task.assignedAgent ||
    !task.workflowVersionRef
  ) {
    throw new MockAgentRuntimeError(
      "Task is not in an executable technical solution state.",
    );
  }

  const nextRecord = task.executionRun.steps.find(
    ({ status, resultType }) =>
      status === "PENDING" && resultType !== "HUMAN_REVIEW",
  );
  if (!nextRecord) {
    throw new MockAgentRuntimeError("No executable Step remains.");
  }
  const planStep = task.executionPlan.steps.find(
    ({ id }) => id === nextRecord.stepId,
  );
  if (!planStep || planStep.stepType === "HUMAN_REVIEW") {
    throw new MockAgentRuntimeError("Workflow Step is unavailable.");
  }

  const isArtifactStep = planStep.sequence === 4;
  const outputReference = isArtifactStep
    ? `artifact-draft-${task.id}`
    : `run-${task.id}-step-${String(planStep.sequence).padStart(2, "0")}-output`;
  const outputDigest = `sha256:${packageDigest(task)}:step-${planStep.sequence}`;
  const stepResult: RuntimeStepResult = {
    stepId: planStep.id,
    resultType: isArtifactStep ? "ARTIFACT_DRAFT" : "STEP_SUCCEEDED",
    summary:
      RUNTIME_STEP_SUMMARIES[planStep.sequence] ??
      "步骤已按固定 WorkflowVersion 完成。",
    outputReference,
    outputDigest,
  };

  if (!isArtifactStep) {
    return { stepResult };
  }

  const artifactId = `artifact-${task.id}`;
  const artifactVersionId = `${artifactId}-v1`;
  const knowledgeVersion = task.knowledgeVersionRefs[0];
  const citation = {
    knowledgeVersionId: knowledgeVersion.versionId,
    locator: "README.md#5-系统整体架构",
    digest: `sha256:citation:${knowledgeVersion.versionId}:readme-architecture`,
  };
  const artifactDraft: TechnicalSolutionArtifactDraft = {
    scope: { ...task.scope },
    taskId: task.id,
    runId: task.executionRun.id,
    title: `${task.title} · 技术方案`,
    sections: buildSections(task),
    citations: [citation],
    agentVersionId: task.assignedAgent.agentVersionRef.versionId,
    capabilityVersionIds: task.capabilityVersionRefs.map(
      ({ versionId }) => versionId,
    ),
    knowledgeVersionIds: task.knowledgeVersionRefs.map(
      ({ versionId }) => versionId,
    ),
    workflowVersionId: task.workflowVersionRef.versionId,
    toolVersionIds: task.toolVersionRefs.map(({ versionId }) => versionId),
    reviewerUserIds: [...task.reviewerUserIds],
    contentDigest: `sha256:${artifactVersionId}:content`,
  };

  return { stepResult, artifactDraft };
}
