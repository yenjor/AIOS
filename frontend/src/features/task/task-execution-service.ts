import {
  acceptArtifact,
  submitTechnicalSolution,
} from "@/features/artifact/mock/artifact-repository";
import { executeNextTechnicalSolutionStep } from "@/features/agent/mock-agent-runtime";

import {
  approveTaskPlan,
  getTask,
  recordArtifactAcceptance,
  recordExecutionStep,
} from "./mock/task-repository";
import type { RuntimeStepResult, TaskActor, TaskDetail, TaskScope } from "./model";

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
  const runtimeOutput = executeNextTechnicalSolutionStep(task);
  let stepResult: RuntimeStepResult = runtimeOutput.stepResult;

  if (runtimeOutput.artifactDraft) {
    const artifact = await submitTechnicalSolution(
      "agent-rd-001",
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
