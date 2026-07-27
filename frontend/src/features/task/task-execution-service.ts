import {
  acceptArtifact,
  submitTechnicalSolution,
} from "@/features/artifact/mock/artifact-repository";
import { executeNextTechnicalSolutionStep } from "@/features/agent/mock-agent-runtime";
import { getCapability } from "@/features/capability/mock/capability-repository";
import type { CapabilityVersion } from "@/features/capability/model";
import {
  listTaskModelInvocations,
  recordModelInvocation,
} from "@/features/model-gateway/mock/model-invocation-repository";
import { invokeTechnicalDesignModel } from "@/features/model-gateway/model-invocation-client";
import type {
  InvokeTechnicalDesignModelInput,
  ModelInvocationResult,
} from "@/features/model-gateway/model";
import {
  listTaskToolInvocations,
  recordToolInvocation,
  resolvePublishedToolActionOption,
} from "@/features/tool/mock/tool-repository";
import type {
  InvokeCodeGraphContextInput,
  ToolInvocationResult,
} from "@/features/tool/model";
import { invokeCodeGraphContext } from "@/features/tool/tool-invocation-client";

import {
  approveTaskPlan,
  getTask,
  recordArtifactAcceptance,
  recordExecutionStep,
} from "./mock/task-repository";
import type { RuntimeStepResult, TaskActor, TaskDetail, TaskScope } from "./model";

function createCodeGraphRequest(
  task: TaskDetail,
  actor: TaskActor,
  attemptNumber: number,
): InvokeCodeGraphContextInput {
  if (!task.executionRun || !task.assignedAgent) {
    throw new Error("ExecutionRun and assigned Agent are required.");
  }
  const toolRef = task.toolVersionRefs.find(
    ({ actionId }) => actionId === "codegraph.context",
  );
  if (
    !toolRef ||
    toolRef.objectId !== "tool-codegraph-read" ||
    toolRef.versionId !== "tool-codegraph-read-v1" ||
    toolRef.digest !== "sha256:tool-codegraph-read-v1" ||
    toolRef.operationType !== "READ"
  ) {
    throw new Error(
      "Execution Package does not pin the published codegraph.context ToolVersion.",
    );
  }
  const query = [
    `为 Task「${task.title}」读取 AIOS 当前实现的相关代码结构、调用关系、约束和测试入口。`,
    `目标：${task.goal}`,
    `当前问题：${task.goalSummary}`,
    "只返回与该 Task 技术方案有关的只读项目上下文。",
  ]
    .join("\n")
    .slice(0, 1_200);
  return {
    scope: { ...task.scope },
    actorId: actor.userId,
    humanOwnerUserId: task.assignedAgent.humanOwner.userId,
    taskId: task.id,
    runId: task.executionRun.id,
    agentId: task.assignedAgent.agentId,
    agentVersionId: task.assignedAgent.agentVersionRef.versionId,
    capabilityVersionIds: task.capabilityVersionRefs.map(
      ({ versionId }) => versionId,
    ),
    executionPackageDigest: task.executionRun.executionPackageDigest,
    toolVersionId: "tool-codegraph-read-v1",
    toolVersionDigest: "sha256:tool-codegraph-read-v1",
    action: "codegraph.context",
    actionDigest: "sha256:codegraph-context-action-v1",
    operationType: "READ",
    riskLevel: "R0",
    idempotencyKey: `${task.executionRun.id}:step-02:codegraph.context:attempt-${String(
      attemptNumber,
    ).padStart(2, "0")}`,
    query,
  };
}

function latestSuccessfulInvocation(
  invocations: ToolInvocationResult[],
): ToolInvocationResult | undefined {
  return invocations
    .filter(({ status }) => status === "SUCCEEDED")
    .at(-1);
}

function latestSuccessfulModelInvocation(
  invocations: ModelInvocationResult[],
): ModelInvocationResult | undefined {
  return invocations.filter(({ status }) => status === "SUCCEEDED").at(-1);
}

async function resolvePinnedCapabilityVersion(
  task: TaskDetail,
  actor: TaskActor,
): Promise<CapabilityVersion> {
  const reference = task.capabilityVersionRefs[0];
  if (!reference) throw new Error("Execution Package requires CapabilityVersion.");
  const capability = await getCapability(task.scope, actor, reference.objectId);
  const version = capability.versions.find(({ id }) => id === reference.versionId);
  if (
    !version ||
    capability.publishedVersionId !== version.id ||
    version.status !== "PUBLISHED" ||
    version.contentDigest !== reference.digest ||
    version.skillDefinition.taskTypes.length !== 1 ||
    version.skillDefinition.taskTypes[0] !== "GENERATE_TECHNICAL_DESIGN" ||
    version.artifactContract.artifactType !== "TECHNICAL_DESIGN" ||
    version.modelPolicy.profile !== "reasoning-structured-output" ||
    !version.modelPolicy.structuredOutputRequired ||
    !version.modelPolicy.toolCallingRequired
  ) {
    throw new Error(
      "Published CapabilityVersion no longer matches the pinned technical-design execution contract.",
    );
  }
  return version;
}

function createModelRequest(
  task: TaskDetail,
  actor: TaskActor,
  capabilityVersion: CapabilityVersion,
  toolInvocation: ToolInvocationResult,
  attemptNumber: number,
): InvokeTechnicalDesignModelInput {
  if (!task.executionRun || !task.assignedAgent || !task.workflowVersionRef) {
    throw new Error("ExecutionRun, Agent and WorkflowVersion are required.");
  }
  if (
    toolInvocation.status !== "SUCCEEDED" ||
    !toolInvocation.outputDigest ||
    !toolInvocation.resultReference
  ) {
    throw new Error("A successful Tool Invocation is required before model reasoning.");
  }
  return {
    scope: { ...task.scope },
    actorId: actor.userId,
    humanOwnerUserId: task.assignedAgent.humanOwner.userId,
    taskId: task.id,
    runId: task.executionRun.id,
    agentId: task.assignedAgent.agentId,
    agentVersionId: task.assignedAgent.agentVersionRef.versionId,
    capabilityVersionId: capabilityVersion.id,
    capabilityVersionDigest: capabilityVersion.contentDigest,
    promptVersionId: capabilityVersion.promptTemplateRef.versionId,
    promptVersionDigest: capabilityVersion.promptTemplateRef.digest,
    promptVariableSchema: capabilityVersion.promptTemplateRef.variableSchema,
    promptOutputSchema: capabilityVersion.promptTemplateRef.outputSchema,
    modelPolicyProfile: capabilityVersion.modelPolicy.profile,
    executionPackageDigest: task.executionRun.executionPackageDigest,
    workflowVersionId: task.workflowVersionRef.versionId,
    toolInvocationId: toolInvocation.id,
    toolResultReference: toolInvocation.resultReference,
    toolOutputDigest: toolInvocation.outputDigest,
    toolResultExcerpt: toolInvocation.resultExcerpt ?? toolInvocation.summary,
    title: task.title,
    goal: task.goal,
    goalSummary: task.goalSummary,
    constraints: [...task.constraints],
    outOfScope: [...task.outOfScope],
    completionCriteria: [...task.completionCriteria],
    knowledgeVersions: task.knowledgeVersionRefs.map(({ versionId, digest }) => ({
      versionId,
      digest,
    })),
    idempotencyKey: `${task.executionRun.id}:step-03:model:attempt-${String(
      attemptNumber,
    ).padStart(2, "0")}`,
  };
}

export async function approvePlanAndStartExecution(
  scope: TaskScope,
  actor: TaskActor,
  taskId: string,
): Promise<TaskDetail> {
  return approveTaskPlan(scope, actor, taskId);
}

export async function advanceFirstAiEmployee(
  scope: TaskScope,
  actor: TaskActor,
  taskId: string,
): Promise<TaskDetail> {
  const task = await getTask(scope, actor, taskId);
  const nextStep = task.executionRun?.steps.find(
    ({ status, resultType }) =>
      status === "PENDING" && resultType !== "HUMAN_REVIEW",
  );
  const invocations = await listTaskToolInvocations(scope, actor, taskId);
  let invocation = latestSuccessfulInvocation(invocations);
  const modelInvocations = await listTaskModelInvocations(
    scope,
    actor,
    taskId,
  );
  let modelInvocation = latestSuccessfulModelInvocation(modelInvocations);
  if (nextStep?.sequence === 2) {
    const publishedAction = await resolvePublishedToolActionOption(
      scope,
      actor,
      "tool-codegraph-read-v1",
      "codegraph.context",
    );
    if (
      publishedAction.toolVersionDigest !==
        "sha256:tool-codegraph-read-v1" ||
      publishedAction.actionDigest !==
        "sha256:codegraph-context-action-v1" ||
      publishedAction.operationType !== "READ" ||
      publishedAction.riskLevel !== "R0"
    ) {
      throw new Error(
        "Published Tool Action no longer matches the pinned Execution Package.",
      );
    }
    const invocationResult = await invokeCodeGraphContext(
      createCodeGraphRequest(
        task,
        actor,
        invocations.filter(
          ({ runId, action }) =>
            runId === task.executionRun?.id &&
            action === "codegraph.context",
        ).length + 1,
      ),
    );
    invocation = await recordToolInvocation(
      scope,
      actor,
      invocationResult,
    );
    if (invocation.status !== "SUCCEEDED") {
      throw new Error(
        `Tool Invocation ${invocation.id} ended as ${invocation.status}: ${invocation.summary}`,
      );
    }
  }
  if (nextStep?.sequence === 3 && !modelInvocation) {
    if (!invocation) {
      throw new Error("Model reasoning requires successful CodeGraph evidence.");
    }
    const capabilityVersion = await resolvePinnedCapabilityVersion(task, actor);
    const currentRunModelInvocations = modelInvocations.filter(
      ({ runId }) => runId === task.executionRun?.id,
    );
    if (currentRunModelInvocations.some(({ status }) => status === "UNKNOWN")) {
      throw new Error(
        "Model completion state is UNKNOWN; automatic retry is disabled and Human Owner review is required.",
      );
    }
    if (
      currentRunModelInvocations.length >= capabilityVersion.failurePolicy.retryLimit
    ) {
      throw new Error(
        `Model retry limit ${capabilityVersion.failurePolicy.retryLimit} reached; Human Owner review is required.`,
      );
    }
    const invocationResult = await invokeTechnicalDesignModel(
      createModelRequest(
        task,
        actor,
        capabilityVersion,
        invocation,
        currentRunModelInvocations.length + 1,
      ),
    );
    modelInvocation = await recordModelInvocation(
      scope,
      actor,
      invocationResult,
    );
    if (modelInvocation.status !== "SUCCEEDED") {
      throw new Error(
        `Model Invocation ${modelInvocation.id} ended as ${modelInvocation.status}: ${modelInvocation.summary}`,
      );
    }
  }
  const runtimeOutput = executeNextTechnicalSolutionStep(
    task,
    invocation,
    modelInvocation,
  );
  let stepResult: RuntimeStepResult = runtimeOutput.stepResult;

  if (runtimeOutput.artifactDraft) {
    const artifact = await submitTechnicalSolution(
      task.assignedAgent!.agentId,
      runtimeOutput.artifactDraft,
    );
    const knowledgeVersionRef = task.knowledgeVersionRefs.find(
      ({ versionId }) =>
        versionId === artifact.citations[0].knowledgeVersionId,
    );
    if (!knowledgeVersionRef) {
      throw new Error(
        "Artifact Citation does not match the immutable Execution Package.",
      );
    }
    stepResult = {
      ...stepResult,
      artifactVersionRef: {
        kind: "ARTIFACT",
        objectId: artifact.id,
        versionId: artifact.version.versionId,
        versionNumber: artifact.version.versionNumber,
        digest: artifact.version.digest,
        artifactType: artifact.artifactType,
        accepted: false,
      },
      citationRefs: artifact.citations.map((citation) => ({
        knowledgeVersionRef: { ...knowledgeVersionRef },
        locator: citation.locator,
        digest: citation.digest,
      })),
    };
  }

  return recordExecutionStep(scope, actor, taskId, stepResult);
}

export async function acceptTaskArtifact(
  scope: TaskScope,
  actor: TaskActor,
  taskId: string,
): Promise<TaskDetail> {
  const task = await getTask(scope, actor, taskId);
  const artifactRef = task.artifactVersionRefs.find(
    ({ accepted }) => !accepted,
  );
  if (!artifactRef) {
    throw new Error("Task does not have a pending ArtifactVersion.");
  }
  const artifact = await acceptArtifact(scope, actor, artifactRef.objectId);
  return recordArtifactAcceptance(
    scope,
    actor,
    taskId,
    artifact.version.versionId,
  );
}
