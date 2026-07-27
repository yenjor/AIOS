import type {
  ModelInvocationAuditEventType,
  ModelInvocationResult,
  ModelInvocationScope,
} from "../model";

export const MODEL_INVOCATION_STORE_KEY =
  "aios.mock.model-invocation-store.v1";

interface ModelInvocationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface ModelInvocationStoreEnvelope {
  schemaVersion: 1;
  invocations: ModelInvocationResult[];
}

const validEventTypes = new Set<ModelInvocationAuditEventType>([
  "MODEL_INVOCATION_REQUESTED",
  "MODEL_POLICY_ALLOWED",
  "MODEL_GATEWAY_DISPATCHED",
  "MODEL_RESPONSE_RECEIVED",
  "MODEL_OUTPUT_VALIDATED",
  "MODEL_INVOCATION_FAILED",
  "MODEL_INVOCATION_UNKNOWN",
]);
const validErrorClassifications = new Set([
  "GATEWAY_NOT_CONFIGURED",
  "GATEWAY_UNAVAILABLE",
  "GATEWAY_TIMEOUT",
  "RATE_LIMITED",
  "PROVIDER_ERROR",
  "OUTPUT_INVALID",
]);
const validActorIds = new Set([
  "user-pm",
  "user-dev",
  "user-lead",
  "user-admin",
  "user-auditor",
]);

function storage(): ModelInvocationStorage {
  if (typeof window === "undefined") {
    throw new Error("模型调用存储仅可在浏览器中使用。");
  }
  return window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isScope(value: unknown): value is ModelInvocationScope {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["organizationId", "workspaceId"]) &&
    value.organizationId === "org-guangwei" &&
    value.workspaceId === "ws-ai"
  );
}

function isSections(value: unknown): boolean {
  const titles = [
    "目标理解",
    "范围与不做事项",
    "影响模块与文件",
    "技术决策",
    "风险",
    "测试建议",
    "回退考虑",
    "知识库引用",
  ];
  return (
    Array.isArray(value) &&
    value.length === titles.length &&
    value.every(
      (section, index) =>
        isRecord(section) &&
        section.title === titles[index] &&
        Array.isArray(section.paragraphs) &&
        section.paragraphs.length >= 1 &&
        section.paragraphs.length <= 8 &&
        section.paragraphs.every(
          (paragraph) =>
            typeof paragraph === "string" &&
            paragraph.trim().length >= 8 &&
            paragraph.length <= 1_200,
        ),
    )
  );
}

function isInvocation(value: unknown): value is ModelInvocationResult {
  if (!isRecord(value) || !isScope(value.scope)) return false;
  const status = String(value.status);
  const succeeded = status === "SUCCEEDED";
  const auditEvents = value.auditEvents;
  return (
    hasExactKeys(
      value,
      [
        "id",
        "scope",
        "taskId",
        "runId",
        "actorId",
        "agentId",
        "agentVersionId",
        "capabilityVersionId",
        "promptVersionId",
        "modelPolicyProfile",
        "modelAlias",
        "status",
        "idempotencyKey",
        "inputDigest",
        "promptDigest",
        "summary",
        "requestedAt",
        "completedAt",
        "durationMs",
        "auditEvents",
      ],
      [
        "resolvedModel",
        "provider",
        "outputDigest",
        "resultReference",
        "sections",
        "errorClassification",
        "usage",
      ],
    ) &&
    /^model-invocation-[a-f0-9]{16}$/.test(String(value.id)) &&
    typeof value.taskId === "string" &&
    value.runId === `run-${value.taskId}-01` &&
    ["user-lead", "user-admin"].includes(String(value.actorId)) &&
    typeof value.agentId === "string" &&
    value.agentVersionId === `${value.agentId}-v1` &&
    value.capabilityVersionId === "capability-technical-solution-v1" &&
    value.promptVersionId === "prompt-technical-solution-v1" &&
    value.modelPolicyProfile === "reasoning-structured-output" &&
    typeof value.modelAlias === "string" &&
    value.modelAlias.length > 0 &&
    (value.provider === undefined ||
      (typeof value.provider === "string" && value.provider.length <= 128)) &&
    ["SUCCEEDED", "FAILED", "UNKNOWN"].includes(status) &&
    typeof value.idempotencyKey === "string" &&
    typeof value.inputDigest === "string" &&
    String(value.inputDigest).startsWith("sha256:") &&
    typeof value.promptDigest === "string" &&
    String(value.promptDigest).startsWith("sha256:") &&
    typeof value.summary === "string" &&
    value.summary.length > 0 &&
    value.summary.length <= 500 &&
    isIsoTimestamp(value.requestedAt) &&
    isIsoTimestamp(value.completedAt) &&
    typeof value.durationMs === "number" &&
    Number.isFinite(value.durationMs) &&
    value.durationMs >= 0 &&
    Array.isArray(auditEvents) &&
    auditEvents.length >= 4 &&
    auditEvents.length <= 5 &&
    auditEvents.every(
      (event, index) =>
        isRecord(event) &&
        hasExactKeys(event, [
          "sequence",
          "eventType",
          "occurredAt",
          "summary",
        ]) &&
        event.sequence === index + 1 &&
        validEventTypes.has(event.eventType as ModelInvocationAuditEventType) &&
        isIsoTimestamp(event.occurredAt) &&
        typeof event.summary === "string" &&
        event.summary.length > 0 &&
        event.summary.length <= 500,
    ) &&
    (succeeded
      ? typeof value.outputDigest === "string" &&
        String(value.outputDigest).startsWith("sha256:") &&
        typeof value.resultReference === "string" &&
        String(value.resultReference).startsWith("model://litellm/") &&
        typeof value.resolvedModel === "string" &&
        value.resolvedModel.length > 0 &&
        isSections(value.sections) &&
        value.errorClassification === undefined &&
        (value.usage === undefined ||
          (isRecord(value.usage) &&
            hasExactKeys(value.usage, [
              "promptTokens",
              "completionTokens",
              "totalTokens",
            ]) &&
            [
              value.usage.promptTokens,
              value.usage.completionTokens,
              value.usage.totalTokens,
            ].every(
              (count) =>
                typeof count === "number" &&
                Number.isInteger(count) &&
                count >= 0,
            )))
      : value.outputDigest === undefined &&
        value.resultReference === undefined &&
        value.sections === undefined &&
        typeof value.errorClassification === "string" &&
        validErrorClassifications.has(value.errorClassification) &&
        value.usage === undefined)
  );
}

function readEnvelope(target: ModelInvocationStorage): ModelInvocationStoreEnvelope {
  const raw = target.getItem(MODEL_INVOCATION_STORE_KEY);
  if (raw === null) return { schemaVersion: 1, invocations: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      !hasExactKeys(parsed, ["schemaVersion", "invocations"]) ||
      parsed.schemaVersion !== 1 ||
      !Array.isArray(parsed.invocations) ||
      !parsed.invocations.every(isInvocation)
    ) {
      throw new Error("invalid");
    }
    return parsed as unknown as ModelInvocationStoreEnvelope;
  } catch {
    target.removeItem(MODEL_INVOCATION_STORE_KEY);
    throw new Error(
      "模型调用本地数据未通过完整性校验，已拒绝加载。",
    );
  }
}

function assertScope(scope: ModelInvocationScope): void {
  if (!isScope(scope)) throw new Error("模型调用作用域无效。");
}

export async function listTaskModelInvocations(
  scope: ModelInvocationScope,
  actor: { userId: string },
  taskId: string,
): Promise<ModelInvocationResult[]> {
  assertScope(scope);
  if (!validActorIds.has(actor.userId) || !taskId) {
    throw new Error("模型调用查询条件无效。");
  }
  return structuredClone(
    readEnvelope(storage()).invocations.filter(
      (invocation) =>
        invocation.taskId === taskId &&
        invocation.scope.organizationId === scope.organizationId &&
        invocation.scope.workspaceId === scope.workspaceId,
    ),
  );
}

export async function recordModelInvocation(
  scope: ModelInvocationScope,
  actor: { userId: string },
  invocation: ModelInvocationResult,
): Promise<ModelInvocationResult> {
  assertScope(scope);
  if (
    !validActorIds.has(actor.userId) ||
    !isInvocation(invocation) ||
    invocation.scope.organizationId !== scope.organizationId ||
    invocation.scope.workspaceId !== scope.workspaceId ||
    invocation.actorId !== actor.userId
  ) {
    throw new Error("模型调用结果与当前作用域不匹配。");
  }
  const target = storage();
  const envelope = readEnvelope(target);
  const existing = envelope.invocations.find(({ id }) => id === invocation.id);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(invocation)) {
      throw new Error("模型调用标识已绑定到其他证据。");
    }
    return structuredClone(existing);
  }
  envelope.invocations.push(structuredClone(invocation));
  target.setItem(MODEL_INVOCATION_STORE_KEY, JSON.stringify(envelope));
  return structuredClone(invocation);
}
