import type {
  InvokeCodeGraphContextInput,
  ToolInvocationResult,
} from "./model";

interface InvocationResponse {
  data?: unknown;
  error?: { code?: unknown; message?: unknown };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isInvocationResult(value: unknown): value is ToolInvocationResult {
  if (!isRecord(value) || !isRecord(value.scope)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.taskId === "string" &&
    typeof value.runId === "string" &&
    typeof value.actorId === "string" &&
    typeof value.toolVersionId === "string" &&
    typeof value.action === "string" &&
    value.operationType === "READ" &&
    value.riskLevel === "R0" &&
    ["SUCCEEDED", "FAILED", "DENIED", "UNKNOWN"].includes(
      String(value.status),
    ) &&
    typeof value.idempotencyKey === "string" &&
    typeof value.inputDigest === "string" &&
    typeof value.summary === "string" &&
    Array.isArray(value.auditEvents)
  );
}

export async function invokeCodeGraphContext(
  input: InvokeCodeGraphContextInput,
): Promise<ToolInvocationResult> {
  const response = await fetch(
    "/api/runtime/tool-invocations/codegraph-context",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-AIOS-Runtime-Contract": "local-pilot-v1",
      },
      cache: "no-store",
      body: JSON.stringify(input),
    },
  );
  let envelope: InvocationResponse;
  try {
    envelope = (await response.json()) as InvocationResponse;
  } catch {
    throw new Error("Tool Broker returned a non-JSON response.");
  }
  if (isInvocationResult(envelope.data)) {
    return envelope.data;
  }
  const message =
    isRecord(envelope.error) && typeof envelope.error.message === "string"
      ? envelope.error.message
      : `Tool Broker rejected the invocation (${response.status}).`;
  throw new Error(message);
}
