import { createHash } from "node:crypto";

import type {
  InvokeCodeGraphContextInput,
  ToolInvocationAuditEvent,
  ToolInvocationResult,
} from "../model";
import {
  CodeGraphMcpError,
  createCodeGraphMcpAdapter,
  type CodeGraphMcpAdapter,
} from "./codegraph-mcp-adapter";

export class ToolBrokerError extends Error {
  constructor(
    public readonly code:
      | "INVALID_REQUEST"
      | "PERMISSION_DENIED"
      | "VERSION_MISMATCH",
    message: string,
    public readonly httpStatus: 400 | 403 | 409,
  ) {
    super(message);
    this.name = "ToolBrokerError";
  }
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function timestamp(clock: () => Date): string {
  return clock().toISOString();
}

function validateRequest(
  input: InvokeCodeGraphContextInput,
): InvokeCodeGraphContextInput {
  if (
    !input ||
    input.scope?.organizationId !== "org-guangwei" ||
    input.scope?.workspaceId !== "ws-ai" ||
    !/^[a-z0-9][a-z0-9-]{2,95}$/.test(input.taskId) ||
    !/^run-[a-z0-9-]+-01$/.test(input.runId) ||
    !/^agent-[a-z0-9-]+$/.test(input.agentId) ||
    !/^agent-[a-z0-9-]+-v\d+$/.test(input.agentVersionId) ||
    !Array.isArray(input.capabilityVersionIds) ||
    input.capabilityVersionIds.length === 0 ||
    input.capabilityVersionIds.length > 8 ||
    !input.capabilityVersionIds.every((value) =>
      /^capability-[a-z0-9-]+-v\d+$/.test(value),
    ) ||
    !input.executionPackageDigest.startsWith("sha256:") ||
    !input.idempotencyKey.startsWith(`${input.runId}:`) ||
    typeof input.query !== "string" ||
    input.query.trim().length < 16 ||
    input.query.length > 1_200 ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(input.query)
  ) {
    throw new ToolBrokerError(
      "INVALID_REQUEST",
      "工具动作请求不满足受限执行契约。",
      400,
    );
  }
  if (
    input.actorId !== input.humanOwnerUserId ||
    !["user-lead", "user-admin"].includes(input.actorId)
  ) {
    throw new ToolBrokerError(
      "PERMISSION_DENIED",
      "只有已分配 AI 员工的人工负责人可以推进本地试点调用。",
      403,
    );
  }
  if (
    input.toolVersionId !== "tool-codegraph-read-v1" ||
    input.toolVersionDigest !== "sha256:tool-codegraph-read-v1" ||
    input.action !== "codegraph.context" ||
    input.actionDigest !== "sha256:codegraph-context-action-v1" ||
    input.operationType !== "READ" ||
    input.riskLevel !== "R0"
  ) {
    throw new ToolBrokerError(
      "VERSION_MISMATCH",
      "工具版本、动作定义、操作类型或风险等级不符合已发布的只读契约。",
      409,
    );
  }
  return {
    ...input,
    query: input.query.trim(),
    capabilityVersionIds: [...new Set(input.capabilityVersionIds)].sort(),
  };
}

interface IdempotencyRecord {
  requestFingerprint: string;
  result: ToolInvocationResult;
}

const idempotencyCache = new Map<string, IdempotencyRecord>();

export function createToolBroker({
  adapter = createCodeGraphMcpAdapter(),
  clock = () => new Date(),
}: {
  adapter?: CodeGraphMcpAdapter;
  clock?: () => Date;
} = {}) {
  return {
    async invokeCodeGraphContext(
      rawInput: InvokeCodeGraphContextInput,
    ): Promise<ToolInvocationResult> {
      const input = validateRequest(rawInput);
      const requestFingerprint = digest(JSON.stringify(input));
      const cached = idempotencyCache.get(input.idempotencyKey);
      if (cached) {
        if (cached.requestFingerprint !== requestFingerprint) {
          throw new ToolBrokerError(
            "INVALID_REQUEST",
            "幂等键已绑定到其他工具动作请求。",
            409,
          );
        }
        return structuredClone(cached.result);
      }

      const requestedAt = timestamp(clock);
      const started = Date.now();
      const invocationId = `invocation-${digest(
        `${input.taskId}:${input.runId}:${input.idempotencyKey}`,
      ).slice(7, 23)}`;
      const inputDigest = digest(
        JSON.stringify({
          taskId: input.taskId,
          runId: input.runId,
          agentVersionId: input.agentVersionId,
          capabilityVersionIds: input.capabilityVersionIds,
          toolVersionId: input.toolVersionId,
          action: input.action,
          executionPackageDigest: input.executionPackageDigest,
          query: input.query,
        }),
      );
      const events: ToolInvocationAuditEvent[] = [
        {
          sequence: 1,
          eventType: "TOOL_INVOCATION_REQUESTED",
          occurredAt: requestedAt,
          summary:
            "固定工具版本、动作、任务、执行记录与幂等键已创建。",
        },
        {
          sequence: 2,
          eventType: "TOOL_PERMISSION_ALLOWED",
          occurredAt: requestedAt,
          summary:
            "人工负责人、工作空间、读取操作/R0 与固定执行包交集校验通过。",
        },
      ];

      let result: ToolInvocationResult;
      try {
        const output = await adapter.context(input.query);
        const completedAt = timestamp(clock);
        const excerpt = output.text.slice(0, 8_000);
        const outputDigest = digest(output.text);
        events.push(
          {
            sequence: 3,
            eventType: "MCP_SESSION_INITIALIZED",
            occurredAt: completedAt,
            summary: `MCP ${output.serverIdentity}@${output.serverVersion} 会话初始化并完成动作调用。`,
          },
          {
            sequence: 4,
            eventType: "TOOL_INVOCATION_SUCCEEDED",
            occurredAt: completedAt,
            summary: "结果已完成大小限制、结构归一化与摘要固定。",
          },
        );
        result = {
          id: invocationId,
          scope: { ...input.scope },
          taskId: input.taskId,
          runId: input.runId,
          actorId: input.actorId,
          agentId: input.agentId,
          agentVersionId: input.agentVersionId,
          capabilityVersionIds: [...input.capabilityVersionIds],
          toolId: "tool-codegraph-read",
          toolVersionId: input.toolVersionId,
          toolVersionDigest: input.toolVersionDigest,
          action: input.action,
          actionDigest: input.actionDigest,
          operationType: "READ",
          riskLevel: "R0",
          status: "SUCCEEDED",
          idempotencyKey: input.idempotencyKey,
          inputDigest,
          outputDigest,
          resultReference: `mcp://codegraph/${invocationId}`,
          resultExcerpt: excerpt,
          summary: `CodeGraph MCP 返回 ${output.text.length} 个字符的受控代码上下文。`,
          requestedAt,
          completedAt,
          durationMs: Math.max(0, Date.now() - started),
          serverIdentity: output.serverIdentity,
          serverVersion: output.serverVersion,
          schemaDigest: "sha256:codegraph-context-output-v1",
          auditEvents: events,
        };
      } catch (error) {
        const completedAt = timestamp(clock);
        const mcpError =
          error instanceof CodeGraphMcpError
            ? error
            : new CodeGraphMcpError(
                "MCP_UNAVAILABLE",
                "CodeGraph MCP 调用失败。",
              );
        const unknown = mcpError.code === "TRANSPORT_TIMEOUT";
        if (mcpError.sessionInitialized) {
          events.push({
            sequence: 3,
            eventType: "MCP_SESSION_INITIALIZED",
            occurredAt: completedAt,
            summary: "MCP 会话已初始化，但动作未返回可确认结果。",
          });
        }
        events.push({
          sequence: events.length + 1,
          eventType: unknown
            ? "TOOL_INVOCATION_UNKNOWN"
            : "TOOL_INVOCATION_FAILED",
          occurredAt: completedAt,
          summary: mcpError.message.slice(0, 500),
        });
        result = {
          id: invocationId,
          scope: { ...input.scope },
          taskId: input.taskId,
          runId: input.runId,
          actorId: input.actorId,
          agentId: input.agentId,
          agentVersionId: input.agentVersionId,
          capabilityVersionIds: [...input.capabilityVersionIds],
          toolId: "tool-codegraph-read",
          toolVersionId: input.toolVersionId,
          toolVersionDigest: input.toolVersionDigest,
          action: input.action,
          actionDigest: input.actionDigest,
          operationType: "READ",
          riskLevel: "R0",
          status: unknown ? "UNKNOWN" : "FAILED",
          idempotencyKey: input.idempotencyKey,
          inputDigest,
          summary: mcpError.message.slice(0, 500),
          errorClassification: mcpError.code,
          requestedAt,
          completedAt,
          durationMs: Math.max(0, Date.now() - started),
          serverIdentity: "codegraph",
          serverVersion: "unknown",
          schemaDigest: "sha256:codegraph-context-output-v1",
          auditEvents: events,
        };
      }

      idempotencyCache.set(input.idempotencyKey, {
        requestFingerprint,
        result: structuredClone(result),
      });
      if (idempotencyCache.size > 100) {
        const oldest = idempotencyCache.keys().next().value;
        if (typeof oldest === "string") idempotencyCache.delete(oldest);
      }
      return structuredClone(result);
    },
  };
}
