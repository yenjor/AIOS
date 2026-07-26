import { resolveAgentVersionForTask } from "./mock/agent-repository";
import type { AgentActor, AgentScope } from "./model";
import type { CapabilityTaskType } from "@/features/capability/model";

export function resolveEnabledAgentVersionForTask(
  scope: AgentScope,
  actor: AgentActor,
  versionId: string,
  taskType: CapabilityTaskType,
  capabilityVersionId: string,
) {
  return resolveAgentVersionForTask(
    scope,
    actor,
    versionId,
    taskType,
    capabilityVersionId,
  );
}
