import {
  acceptArtifact,
  submitTechnicalSolution,
} from "@/features/artifact/mock/artifact-repository";
import { executeNextTechnicalSolutionStep } from "@/features/agent/mock-agent-runtime";
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
  const runtimeOutput = executeNextTechnicalSolutionStep(task, invocation);
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
