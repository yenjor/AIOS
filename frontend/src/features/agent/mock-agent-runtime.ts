import type {
  RuntimeStepResult,
  TaskDetail,
} from "@/features/task/model";
import type {
  ArtifactSection,
  TechnicalSolutionArtifactDraft,
} from "@/features/artifact/model";
import type { ToolInvocationResult } from "@/features/tool/model";
import type { ModelInvocationResult } from "@/features/model-gateway/model";

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
  3: "已依据固定 CapabilityVersion 与 WorkflowVersion 形成结构化技术方案草稿。",
  4: "已完成八个必需章节、知识库引用与 Reviewer 门禁检查。",
};

function invocationHighlights(invocation: ToolInvocationResult): string[] {
  const highlights = (invocation.resultExcerpt ?? "")
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((line) => line.length >= 12)
    .slice(0, 4)
    .map((line, index) => `MCP 证据摘要 ${index + 1}：${line.slice(0, 240)}`);
  return highlights.length > 0
    ? highlights
    : ["CodeGraph MCP 已返回有效结果，但没有可展示的文本摘要。"];
}

function requireSuccessfulInvocation(
  task: TaskDetail,
  invocation: ToolInvocationResult | undefined,
): ToolInvocationResult {
  const toolRef = task.toolVersionRefs.find(
    ({ actionId }) => actionId === "codegraph.context",
  );
  const expectedCapabilityVersions = task.capabilityVersionRefs
    .map(({ versionId }) => versionId)
    .sort();
  const invocationCapabilityVersions = invocation?.capabilityVersionIds
    .slice()
    .sort();
  if (
    !invocation ||
    invocation.status !== "SUCCEEDED" ||
    invocation.scope.organizationId !== task.scope.organizationId ||
    invocation.scope.workspaceId !== task.scope.workspaceId ||
    invocation.taskId !== task.id ||
    invocation.runId !== task.executionRun?.id ||
    invocation.actorId !== task.assignedAgent?.humanOwner.userId ||
    invocation.agentId !== task.assignedAgent?.agentId ||
    invocation.agentVersionId !==
      task.assignedAgent?.agentVersionRef.versionId ||
    JSON.stringify(invocationCapabilityVersions) !==
      JSON.stringify(expectedCapabilityVersions) ||
    invocation.toolId !== toolRef?.objectId ||
    invocation.toolVersionId !== toolRef?.versionId ||
    invocation.toolVersionDigest !== toolRef?.digest ||
    invocation.action !== toolRef?.actionId ||
    invocation.actionDigest !== "sha256:codegraph-context-action-v1" ||
    invocation.operationType !== "READ" ||
    invocation.riskLevel !== "R0" ||
    !invocation.outputDigest ||
    !invocation.resultReference
  ) {
    throw new MockAgentRuntimeError(
      "A successful invocation of the pinned codegraph.context ToolVersion is required.",
    );
  }
  return invocation;
}

function requireSuccessfulModelInvocation(
  task: TaskDetail,
  invocation: ModelInvocationResult | undefined,
): ModelInvocationResult {
  const capabilityRef = task.capabilityVersionRefs[0];
  if (
    !invocation ||
    invocation.status !== "SUCCEEDED" ||
    invocation.scope.organizationId !== task.scope.organizationId ||
    invocation.scope.workspaceId !== task.scope.workspaceId ||
    invocation.taskId !== task.id ||
    invocation.runId !== task.executionRun?.id ||
    invocation.actorId !== task.assignedAgent?.humanOwner.userId ||
    invocation.agentId !== task.assignedAgent?.agentId ||
    invocation.agentVersionId !== task.assignedAgent?.agentVersionRef.versionId ||
    invocation.capabilityVersionId !== capabilityRef?.versionId ||
    invocation.promptVersionId !== "prompt-technical-solution-v1" ||
    invocation.modelPolicyProfile !== "reasoning-structured-output" ||
    !invocation.outputDigest ||
    !invocation.resultReference ||
    !invocation.resolvedModel ||
    !invocation.sections ||
    invocation.sections.length !== 8
  ) {
    throw new MockAgentRuntimeError(
      "A successful structured Model Invocation for the pinned CapabilityVersion is required.",
    );
  }
  return invocation;
}

function buildSections(
  task: TaskDetail,
  invocation: ToolInvocationResult,
  modelInvocation: ModelInvocationResult,
): ArtifactSection[] {
  const sections = structuredClone(modelInvocation.sections!);
  const impact = sections.find(({ title }) => title === "影响模块与文件");
  if (impact) {
    const evidence = `${invocationHighlights(invocation)[0]}；Tool Invocation ${invocation.id}；Output Digest ${invocation.outputDigest}。`;
    impact.paragraphs = [...impact.paragraphs.slice(0, 7), evidence];
  }
  const knowledge = sections.find(({ title }) => title === "知识库引用");
  if (knowledge) {
    knowledge.paragraphs = task.knowledgeVersionRefs.map(
      (reference) =>
        `${reference.versionId} · ${reference.digest} · locator: README.md#5-系统整体架构`,
    );
  }
  return sections;
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
  toolInvocation?: ToolInvocationResult,
  modelInvocation?: ModelInvocationResult,
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

  const invocation =
    planStep.sequence >= 2
      ? requireSuccessfulInvocation(task, toolInvocation)
      : undefined;
  const structuredModelInvocation =
    planStep.sequence >= 3
      ? requireSuccessfulModelInvocation(task, modelInvocation)
      : undefined;
  const isArtifactStep = planStep.sequence === 4;
  const isToolStep = planStep.sequence === 2;
  const outputReference = isArtifactStep
    ? `artifact-draft-${task.id}`
    : isToolStep
      ? invocation!.resultReference!
      : planStep.sequence === 3
        ? structuredModelInvocation!.resultReference!
      : `run-${task.id}-step-${String(planStep.sequence).padStart(2, "0")}-output`;
  const outputDigest = isToolStep
    ? invocation!.outputDigest!
    : planStep.sequence === 3
      ? structuredModelInvocation!.outputDigest!
    : `sha256:${packageDigest(task)}:step-${planStep.sequence}`;
  const stepResult: RuntimeStepResult = {
    stepId: planStep.id,
    resultType: isArtifactStep ? "ARTIFACT_DRAFT" : "STEP_SUCCEEDED",
    summary:
      isToolStep
        ? `${invocation!.summary} Invocation ${invocation!.id} 已进入 Audit。`
        : planStep.sequence === 3
          ? `${structuredModelInvocation!.summary} Invocation ${structuredModelInvocation!.id} 已进入 Audit。`
        : RUNTIME_STEP_SUMMARIES[planStep.sequence] ??
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
    sections: buildSections(task, invocation!, structuredModelInvocation!),
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
    promptVersionId: structuredModelInvocation!.promptVersionId,
    modelPolicyProfile: structuredModelInvocation!.modelPolicyProfile,
    modelInvocationId: structuredModelInvocation!.id,
    modelAlias: structuredModelInvocation!.modelAlias,
    resolvedModel: structuredModelInvocation!.resolvedModel!,
    modelOutputDigest: structuredModelInvocation!.outputDigest!,
    reviewerUserIds: [...task.reviewerUserIds],
    contentDigest: `sha256:${artifactVersionId}:content`,
  };

  return { stepResult, artifactDraft };
}
