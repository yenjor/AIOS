import type {
  InvokeTechnicalDesignModelInput,
  ModelInvocationResult,
} from "./model";

interface InvocationResponse {
  data?: unknown;
  error?: { code?: unknown; message?: unknown };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isInvocationResult(value: unknown): value is ModelInvocationResult {
  if (!isRecord(value) || !isRecord(value.scope)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.taskId === "string" &&
    typeof value.runId === "string" &&
    typeof value.actorId === "string" &&
    typeof value.capabilityVersionId === "string" &&
    typeof value.promptVersionId === "string" &&
    typeof value.modelPolicyProfile === "string" &&
    typeof value.modelAlias === "string" &&
    ["SUCCEEDED", "FAILED", "UNKNOWN"].includes(String(value.status)) &&
    typeof value.idempotencyKey === "string" &&
    typeof value.inputDigest === "string" &&
    typeof value.promptDigest === "string" &&
    typeof value.summary === "string" &&
    Array.isArray(value.auditEvents)
  );
}

export async function invokeTechnicalDesignModel(
  input: InvokeTechnicalDesignModelInput,
): Promise<ModelInvocationResult> {
  const response = await fetch(
    "/api/runtime/model-invocations/technical-design",
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
    throw new Error("Model Gateway returned a non-JSON response.");
  }
  if (isInvocationResult(envelope.data)) return envelope.data;
  const message =
    isRecord(envelope.error) && typeof envelope.error.message === "string"
      ? envelope.error.message
      : `Model Gateway rejected the invocation (${response.status}).`;
  throw new Error(message);
}
