import { beforeEach, describe, expect, it } from "vitest";

import type { ModelInvocationResult } from "../model";
import {
  listTaskModelInvocations,
  MODEL_INVOCATION_STORE_KEY,
  recordModelInvocation,
} from "./model-invocation-repository";

const scope = { organizationId: "org-guangwei", workspaceId: "ws-ai" };
const actor = { userId: "user-lead" };

const invocation: ModelInvocationResult = {
  id: "model-invocation-0123456789abcdef",
  scope,
  taskId: "task-mock-0001",
  runId: "run-task-mock-0001-01",
  actorId: "user-lead",
  agentId: "agent-rd-001",
  agentVersionId: "agent-rd-001-v1",
  capabilityVersionId: "capability-technical-solution-v1",
  promptVersionId: "prompt-technical-solution-v1",
  modelPolicyProfile: "reasoning-structured-output",
  modelAlias: "aios-technical-design",
  resolvedModel: "provider/resolved-model",
  status: "SUCCEEDED",
  idempotencyKey:
    "run-task-mock-0001-01:step-03:model:attempt-01",
  inputDigest: "sha256:input",
  promptDigest: "sha256:prompt",
  outputDigest: "sha256:output",
  resultReference:
    "model://litellm/model-invocation-0123456789abcdef",
  sections: [
    "目标理解",
    "范围与不做事项",
    "影响模块与文件",
    "技术决策",
    "风险",
    "测试建议",
    "回退考虑",
    "知识库引用",
  ].map((title) => ({
    title: title as ModelInvocationResult["sections"] extends (infer T)[]
      ? T extends { title: infer U }
        ? U
        : never
      : never,
    paragraphs: [`${title}包含经过校验的模型结果。`],
  })),
  summary: "模型输出已通过结构校验。",
  requestedAt: "2026-07-27T10:00:00.000Z",
  completedAt: "2026-07-27T10:00:01.000Z",
  durationMs: 1_000,
  usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  auditEvents: [
    "MODEL_INVOCATION_REQUESTED",
    "MODEL_POLICY_ALLOWED",
    "MODEL_GATEWAY_DISPATCHED",
    "MODEL_RESPONSE_RECEIVED",
    "MODEL_OUTPUT_VALIDATED",
  ].map((eventType, index) => ({
    sequence: index + 1,
    eventType: eventType as ModelInvocationResult["auditEvents"][number]["eventType"],
    occurredAt: "2026-07-27T10:00:00.000Z",
    summary: `${eventType} evidence`,
  })),
};

describe("模型调用 repository", () => {
  beforeEach(() => window.localStorage.clear());

  it("persists immutable model evidence scoped to the 任务", async () => {
    await expect(recordModelInvocation(scope, actor, invocation)).resolves.toEqual(
      invocation,
    );
    await expect(
      listTaskModelInvocations(scope, actor, invocation.taskId),
    ).resolves.toEqual([invocation]);
    await expect(recordModelInvocation(scope, actor, invocation)).resolves.toEqual(
      invocation,
    );
  });

  it("fails closed and clears tampered model evidence", async () => {
    window.localStorage.setItem(
      MODEL_INVOCATION_STORE_KEY,
      JSON.stringify({ schemaVersion: 1, invocations: [{ id: "tampered" }] }),
    );
    await expect(
      listTaskModelInvocations(scope, actor, invocation.taskId),
    ).rejects.toThrow(/完整性校验/);
    expect(window.localStorage.getItem(MODEL_INVOCATION_STORE_KEY)).toBeNull();
  });
});
