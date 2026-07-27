import { describe, expect, it, vi } from "vitest";

import type { InvokeTechnicalDesignModelInput } from "../model";
import {
  createLiteLlmAdapter,
  type LiteLlmAdapter,
} from "./litellm-adapter";
import { createModelGateway, ModelGatewayError } from "./model-gateway";
import { TECHNICAL_DESIGN_SECTION_TITLES } from "./technical-design-output";

function input(taskId = "task-mock-model-01"): InvokeTechnicalDesignModelInput {
  const runId = `run-${taskId}-01`;
  return {
    scope: { organizationId: "org-guangwei", workspaceId: "ws-ai" },
    actorId: "user-lead",
    humanOwnerUserId: "user-lead",
    taskId,
    runId,
    agentId: "agent-rd-001",
    agentVersionId: "agent-rd-001-v1",
    capabilityVersionId: "capability-technical-solution-v1",
    capabilityVersionDigest: "sha256:capability-technical-solution-v1",
    promptVersionId: "prompt-technical-solution-v1",
    promptVersionDigest:
      "sha256:mock-9c62adfb-prompt-technical-solution-v1",
    promptVariableSchema: "task-capability-context-v1",
    promptOutputSchema: "technical_design-v1",
    modelPolicyProfile: "reasoning-structured-output",
    executionPackageDigest: "sha256:execution-package-v1",
    workflowVersionId: "workflow-technical-solution-v1",
    toolInvocationId: "invocation-0123456789abcdef",
    toolResultReference: "mcp://codegraph/invocation-0123456789abcdef",
    toolOutputDigest: "sha256:tool-output",
    toolResultExcerpt: "CodeGraph returned bounded source context for the 任务.",
    title: "生成技术方案",
    goal: "生成可以由验收人验收的 AIOS 技术方案。",
    goalSummary: "当前缺少模型生成的结构化草稿。",
    constraints: ["遵循现有架构边界"],
    outOfScope: ["不执行外部写入"],
    completionCriteria: ["八个章节均有非空内容"],
    knowledgeVersions: [
      {
        versionId: "knowledge-aios-docs-v1",
        digest: "sha256:knowledge-aios-docs-v1",
      },
    ],
    idempotencyKey: `${runId}:step-03:model:attempt-01`,
  };
}

function output(): string {
  return JSON.stringify({
    sections: TECHNICAL_DESIGN_SECTION_TITLES.map((title) => ({
      title,
      paragraphs: [`${title}由受控模型根据当前任务上下文生成。`],
    })),
  });
}

describe("模型网关", () => {
  it("pins policy, validates structured output and returns auditable evidence", async () => {
    const complete = vi.fn(async () => ({
      content: output(),
      resolvedModel: "provider/model-2026-07",
      provider: "test-provider",
      usage: { promptTokens: 120, completionTokens: 240, totalTokens: 360 },
    }));
    const adapter: LiteLlmAdapter = {
      modelAlias: "aios-technical-design",
      complete,
    };
    const gateway = createModelGateway({
      adapter,
      clock: () => new Date("2026-07-27T10:00:00.000Z"),
    });

    const result = await gateway.invokeTechnicalDesign(input());

    expect(result).toMatchObject({
      status: "SUCCEEDED",
      modelAlias: "aios-technical-design",
      resolvedModel: "provider/model-2026-07",
      provider: "test-provider",
      promptVersionId: "prompt-technical-solution-v1",
      modelPolicyProfile: "reasoning-structured-output",
      usage: { totalTokens: 360 },
    });
    expect(result.sections?.map(({ title }) => title)).toEqual(
      TECHNICAL_DESIGN_SECTION_TITLES,
    );
    expect(result.auditEvents.map(({ eventType }) => eventType)).toEqual([
      "MODEL_INVOCATION_REQUESTED",
      "MODEL_POLICY_ALLOWED",
      "MODEL_GATEWAY_DISPATCHED",
      "MODEL_RESPONSE_RECEIVED",
      "MODEL_OUTPUT_VALIDATED",
    ]);
    expect(JSON.stringify(result)).not.toContain("untrustedReadOnlyToolContext");
    expect(complete).toHaveBeenCalledTimes(1);

    const replay = await gateway.invokeTechnicalDesign(input());
    expect(replay).toEqual(result);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the model output violates the eight-section contract", async () => {
    const adapter: LiteLlmAdapter = {
      modelAlias: "aios-technical-design",
      complete: async () => ({
        content: JSON.stringify({ sections: [] }),
        resolvedModel: "provider/model",
      }),
    };
    const result = await createModelGateway({ adapter }).invokeTechnicalDesign(
      input("task-mock-model-invalid"),
    );

    expect(result.status).toBe("FAILED");
    expect(result.errorClassification).toBe("OUTPUT_INVALID");
    expect(result.sections).toBeUndefined();
    expect(result.outputDigest).toBeUndefined();
    expect(result.auditEvents.at(-1)?.eventType).toBe(
      "MODEL_INVOCATION_FAILED",
    );
  });

  it("records an explicit failure instead of fabricating output when LiteLLM is unconfigured", async () => {
    const result = await createModelGateway({
      adapter: createLiteLlmAdapter({ baseUrl: "", modelAlias: "" }),
    }).invokeTechnicalDesign(input("task-mock-model-unconfigured"));

    expect(result).toMatchObject({
      status: "FAILED",
      modelAlias: "unconfigured",
      errorClassification: "GATEWAY_NOT_CONFIGURED",
    });
    expect(result.sections).toBeUndefined();
    expect(result.resultReference).toBeUndefined();
  });

  it("rejects permission and immutable version mismatches before dispatch", async () => {
    const complete = vi.fn();
    const gateway = createModelGateway({
      adapter: { modelAlias: "aios-technical-design", complete },
    });
    const denied = { ...input("task-mock-model-denied"), actorId: "user-dev" };
    await expect(gateway.invokeTechnicalDesign(denied)).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    } satisfies Partial<ModelGatewayError>);

    const mismatched = {
      ...input("task-mock-model-mismatch"),
      promptVersionId: "prompt-unpublished-v9",
    };
    await expect(gateway.invokeTechnicalDesign(mismatched)).rejects.toMatchObject({
      code: "VERSION_MISMATCH",
    } satisfies Partial<ModelGatewayError>);
    expect(complete).not.toHaveBeenCalled();
  });
});
