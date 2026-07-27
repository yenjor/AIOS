import { describe, expect, it, vi } from "vitest";

import type { InvokeCodeGraphContextInput } from "../model";
import {
  CodeGraphMcpError,
  type CodeGraphMcpAdapter,
} from "./codegraph-mcp-adapter";
import { createToolBroker } from "./tool-broker";

function input(
  overrides: Partial<InvokeCodeGraphContextInput> = {},
): InvokeCodeGraphContextInput {
  return {
    scope: {
      organizationId: "org-guangwei",
      workspaceId: "ws-ai",
    },
    actorId: "user-lead",
    humanOwnerUserId: "user-lead",
    taskId: "task-golden-technical-solution",
    runId: "run-task-golden-technical-solution-01",
    agentId: "agent-ai-rd",
    agentVersionId: "agent-ai-rd-v1",
    capabilityVersionIds: ["capability-technical-solution-v1"],
    executionPackageDigest: "sha256:execution-package-v1",
    toolVersionId: "tool-codegraph-read-v1",
    toolVersionDigest: "sha256:tool-codegraph-read-v1",
    action: "codegraph.context",
    actionDigest: "sha256:codegraph-context-action-v1",
    operationType: "READ",
    riskLevel: "R0",
    idempotencyKey:
      "run-task-golden-technical-solution-01:step-02:codegraph.context",
    query: "分析 AIOS Task 执行链的相关模块、调用关系、约束与测试入口。",
    ...overrides,
  };
}

describe("Tool Broker", () => {
  it("executes the pinned read-only action and returns auditable evidence", async () => {
    const context = vi.fn().mockResolvedValue({
      text: "TaskDetailLoader -> task-execution-service -> Agent Runtime",
      sessionInitialized: true,
      serverIdentity: "codegraph",
      serverVersion: "0.9.0",
    });
    const broker = createToolBroker({
      adapter: { context } satisfies CodeGraphMcpAdapter,
      clock: () => new Date("2026-07-27T08:00:00.000Z"),
    });

    const first = await broker.invokeCodeGraphContext(input());
    const repeated = await broker.invokeCodeGraphContext(input());

    expect(context).toHaveBeenCalledTimes(1);
    expect(repeated).toEqual(first);
    expect(first).toMatchObject({
      status: "SUCCEEDED",
      toolVersionId: "tool-codegraph-read-v1",
      action: "codegraph.context",
      operationType: "READ",
      riskLevel: "R0",
      serverIdentity: "codegraph",
      serverVersion: "0.9.0",
      resultReference: expect.stringMatching(/^mcp:\/\/codegraph\/invocation-/),
      inputDigest: expect.stringMatching(/^sha256:/),
      outputDigest: expect.stringMatching(/^sha256:/),
    });
    expect(first.auditEvents.map(({ eventType }) => eventType)).toEqual([
      "TOOL_INVOCATION_REQUESTED",
      "TOOL_PERMISSION_ALLOWED",
      "MCP_SESSION_INITIALIZED",
      "TOOL_INVOCATION_SUCCEEDED",
    ]);
    await expect(
      broker.invokeCodeGraphContext(
        input({ query: "使用相同幂等键读取另一组完全不同的 AIOS 模块上下文。" }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST", httpStatus: 409 });
  });

  it("rejects actors and version refs outside the execution package", async () => {
    const broker = createToolBroker({
      adapter: {
        context: vi.fn(),
      },
    });

    await expect(
      broker.invokeCodeGraphContext(
        input({ actorId: "user-admin", humanOwnerUserId: "user-lead" }),
      ),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED", httpStatus: 403 });
    await expect(
      broker.invokeCodeGraphContext(
        input({
          idempotencyKey:
            "run-task-golden-technical-solution-01:version-mismatch",
          toolVersionDigest: "sha256:unexpected" as never,
        }),
      ),
    ).rejects.toMatchObject({ code: "VERSION_MISMATCH", httpStatus: 409 });
  });

  it("marks an initialized timeout as UNKNOWN for human review", async () => {
    const broker = createToolBroker({
      adapter: {
        context: vi.fn().mockRejectedValue(
          new CodeGraphMcpError(
            "TRANSPORT_TIMEOUT",
            "Invocation deadline exceeded.",
            true,
          ),
        ),
      },
      clock: () => new Date("2026-07-27T08:10:00.000Z"),
    });

    const result = await broker.invokeCodeGraphContext(
      input({
        idempotencyKey:
          "run-task-golden-technical-solution-01:step-02:timeout",
      }),
    );

    expect(result).toMatchObject({
      status: "UNKNOWN",
      errorClassification: "TRANSPORT_TIMEOUT",
    });
    expect(result.auditEvents.map(({ eventType }) => eventType)).toContain(
      "TOOL_INVOCATION_UNKNOWN",
    );
  });
});
