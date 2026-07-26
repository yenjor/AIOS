import { resolvePublishedCapabilityVersion } from "./mock/capability-repository";
import type {
  CapabilityActor,
  CapabilityScope,
  CapabilityTaskType,
} from "./model";

/**
 * Public application contract consumed by Task. It returns an immutable,
 * permission-filtered snapshot and never exposes the Capability aggregate.
 */
export async function resolveCapabilityVersionForTask(
  scope: CapabilityScope,
  actor: CapabilityActor,
  versionId: string,
  taskType: CapabilityTaskType,
) {
  return resolvePublishedCapabilityVersion(
    scope,
    actor,
    versionId,
    taskType,
  );
}
