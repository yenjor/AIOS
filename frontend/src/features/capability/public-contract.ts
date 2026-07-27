import { resolvePublishedCapabilityVersion } from "./mock/capability-repository";
import type {
  CapabilityActor,
  CapabilityScope,
  CapabilityTaskType,
} from "./model";

/**
 * 供任务模块使用的公共应用契约。返回不可变且经过权限过滤的快照，
 * 绝不暴露能力聚合。
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
