import { users } from "@/mock/fixtures";

import type {
  ActionDefinition,
  CreateMcpServerInput,
  McpServerRegistration,
  McpServerSummary,
  Tool,
  ToolActionSelectionOption,
  ToolActor,
  ToolConnectionTestSummary,
  ToolHealthStatus,
  ToolListItem,
  ToolPermissionDecision,
  ToolScope,
  ToolStatus,
  ToolSummary,
  ToolInvocationResult,
  ToolVersion,
} from "../model";

export const TOOL_STORE_KEY = "aios.mock.tool-store.v2";
const STORE_SCHEMA_VERSION = 1;
const DEFAULT_LATENCY_MS = 30;

export type ToolRepositoryErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_STORE"
  | "VALIDATION"
  | "CONFLICT"
  | "TOOL_NOT_PUBLISHABLE";

export class ToolRepositoryError extends Error {
  constructor(
    public readonly code: ToolRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ToolRepositoryError";
  }
}

export interface ToolStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface ToolStoreEnvelope {
  schemaVersion: 1;
  nextSequence: number;
  tools: Tool[];
  mcpServers: McpServerRegistration[];
  invocations: ToolInvocationResult[];
}

export interface ToolRepository {
  getPermission(
    scope: ToolScope,
    actor: ToolActor,
  ): Promise<ToolPermissionDecision>;
  listTools(scope: ToolScope, actor: ToolActor): Promise<ToolListItem[]>;
  getTool(scope: ToolScope, actor: ToolActor, toolId: string): Promise<Tool>;
  getToolSummary(scope: ToolScope, actor: ToolActor): Promise<ToolSummary>;
  listMcpServers(
    scope: ToolScope,
    actor: ToolActor,
  ): Promise<McpServerRegistration[]>;
  getMcpServer(
    scope: ToolScope,
    actor: ToolActor,
    serverId: string,
  ): Promise<McpServerRegistration>;
  getMcpServerSummary(
    scope: ToolScope,
    actor: ToolActor,
  ): Promise<McpServerSummary>;
  createMcpServer(
    scope: ToolScope,
    actor: ToolActor,
    input: CreateMcpServerInput,
  ): Promise<McpServerRegistration>;
  testMcpServer(
    scope: ToolScope,
    actor: ToolActor,
    serverId: string,
  ): Promise<McpServerRegistration>;
  publishMcpServer(
    scope: ToolScope,
    actor: ToolActor,
    serverId: string,
  ): Promise<McpServerRegistration>;
  suspendMcpServer(
    scope: ToolScope,
    actor: ToolActor,
    serverId: string,
    reason: string,
  ): Promise<McpServerRegistration>;
  resumeMcpServer(
    scope: ToolScope,
    actor: ToolActor,
    serverId: string,
  ): Promise<McpServerRegistration>;
  listPublishedActionOptions(
    scope: ToolScope,
    actor: ToolActor,
  ): Promise<ToolActionSelectionOption[]>;
  resolvePublishedActionOption(
    scope: ToolScope,
    actor: ToolActor,
    toolVersionId: string,
    action: string,
  ): Promise<ToolActionSelectionOption>;
  recordInvocation(
    scope: ToolScope,
    actor: ToolActor,
    result: ToolInvocationResult,
  ): Promise<ToolInvocationResult>;
  listTaskInvocations(
    scope: ToolScope,
    actor: ToolActor,
    taskId: string,
  ): Promise<ToolInvocationResult[]>;
}

export interface CreateToolRepositoryOptions {
  storage?: ToolStorage;
  delay?: () => Promise<void>;
  now?: () => string;
}

const canonicalScope: ToolScope = {
  organizationId: "org-guangwei",
  workspaceId: "ws-ai",
};
const validActorIds = new Set(users.map(({ id }) => id));
const managerActorIds = new Set(["user-lead", "user-admin"]);
const usableActorIds = new Set([
  "user-pm",
  "user-dev",
  "user-lead",
  "user-admin",
]);
const toolStatuses = new Set<ToolStatus>([
  "DRAFT",
  "TESTING",
  "PUBLISHED",
  "SUSPENDED",
  "RETIRED",
]);
const healthStatuses = new Set<ToolHealthStatus>([
  "HEALTHY",
  "DEGRADED",
  "UNAVAILABLE",
  "UNKNOWN",
]);

function defaultDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, DEFAULT_LATENCY_MS));
}

function getBrowserStorage(): ToolStorage {
  if (typeof window === "undefined") {
    throw new ToolRepositoryError(
      "INVALID_STORE",
      "Tool / MCP 连接中心仅可在浏览器 Mock Runtime 中使用。",
    );
  }
  return window.localStorage;
}

function cloneMutable<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.endsWith("Z") &&
    !Number.isNaN(Date.parse(value))
  );
}

function stableDigest(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `sha256:mock-${(hash >>> 0).toString(16).padStart(8, "0")}-${value
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36)
    .toLowerCase()}`;
}

function validateScope(scope: ToolScope): void {
  if (
    scope.organizationId !== canonicalScope.organizationId ||
    scope.workspaceId !== canonicalScope.workspaceId
  ) {
    throw new ToolRepositoryError(
      "NOT_FOUND",
      "Tool / MCP 连接中心作用域不可用。",
    );
  }
}

function validateActor(actor: ToolActor): void {
  if (!validActorIds.has(actor.userId)) {
    throw new ToolRepositoryError(
      "FORBIDDEN",
      "Tool / MCP 连接中心操作身份不可用。",
    );
  }
}

function permissionFor(actor: ToolActor): ToolPermissionDecision {
  const canManage = managerActorIds.has(actor.userId);
  return {
    canRead: true,
    canUse: usableActorIds.has(actor.userId),
    canManage,
    canPublish: canManage,
    reason: canManage
      ? "当前身份可注册、测试、审核和治理 Workspace 内的 Tool / MCP Server。"
      : actor.userId === "user-auditor"
        ? "Auditor 仅可查看连接、ActionDefinition、测试与状态证据。"
        : "当前身份可使用已发布 Tool Action，不能修改连接或发布状态。",
  };
}

function requireManager(actor: ToolActor): void {
  if (!managerActorIds.has(actor.userId)) {
    throw new ToolRepositoryError(
      "FORBIDDEN",
      "只有 Workspace Admin 或 Integration Owner 可治理 Tool / MCP Server。",
    );
  }
}

function maxRisk(actions: ActionDefinition[]): ActionDefinition["riskLevel"] {
  const order = ["R0", "R1", "R2", "R3"] as const;
  return actions.reduce<ActionDefinition["riskLevel"]>(
    (current, action) =>
      order.indexOf(action.riskLevel) > order.indexOf(current)
        ? action.riskLevel
        : current,
    "R0",
  );
}

function passingTest(
  serverId: string,
  actorId: string,
  timestamp: string,
): ToolConnectionTestSummary {
  return {
    id: `${serverId}-test-${timestamp}`,
    result: "PASSED",
    identityVerified: true,
    schemaVerified: true,
    permissionNegativePassed: true,
    resultValidationPassed: true,
    secretIsolationPassed: true,
    evidenceReference: `mock://mcp-test/${serverId}/summary`,
    evidenceDigest: stableDigest(`${serverId}:${timestamp}:passed`),
    testedAt: timestamp,
    testedBy: actorId,
  };
}

function seedEnvelope(): ToolStoreEnvelope {
  const timestamp = "2026-07-27T02:30:00.000Z";
  const test = passingTest("mcp-codegraph-local", "user-admin", timestamp);
  const action: ActionDefinition = {
    name: "codegraph.context",
    description: "读取经过 Workspace Scope 限定的代码结构上下文。",
    operationType: "READ",
    riskLevel: "R0",
    inputSchema: "codegraph-context-input-v1",
    outputSchema: "codegraph-context-output-v1",
    permissionRequirement: "TOOL:USE",
    idempotencySemantics: "NATIVE",
    reversible: true,
    definitionDigest: "sha256:codegraph-context-action-v1",
  };
  const version: ToolVersion = {
    id: "tool-codegraph-read-v1",
    versionNumber: 1,
    status: "PUBLISHED",
    schemaVersion: 1,
    contentDigest: "sha256:tool-codegraph-read-v1",
    pluginManifestRef: "plugin-mcp-codegraph@1.0.0",
    mcpServerId: "mcp-codegraph-local",
    actions: [action],
    healthStatus: "HEALTHY",
    invocationPolicy: {
      timeoutMs: 15_000,
      retryLimit: 1,
      unknownResultPolicy: "HUMAN_REVIEW",
    },
    testSummaries: [test],
    createdAt: timestamp,
    createdBy: "user-admin",
    publishedAt: timestamp,
    publishedBy: "user-admin",
  };
  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    nextSequence: 1,
    tools: [
      {
        id: "tool-codegraph-read",
        scope: cloneMutable(canonicalScope),
        code: "CODEGRAPH_READ",
        name: "CodeGraph 代码理解",
        description:
          "通过受控 MCP Server 提供只读代码结构上下文，不执行命令或代码写入。",
        ownerId: "user-admin",
        status: "PUBLISHED",
        publishedVersionId: version.id,
        versions: [version],
        aggregateVersion: 1,
        createdAt: timestamp,
        createdBy: "user-admin",
        updatedAt: timestamp,
        updatedBy: "user-admin",
      },
    ],
    mcpServers: [
      {
        id: "mcp-codegraph-local",
        scope: cloneMutable(canonicalScope),
        serverIdentity: "aios.codegraph.local",
        displayName: "CodeGraph 本地 MCP Server",
        publisher: "AIOS Internal",
        serverVersion: "1.0.0",
        transport: "STDIO",
        endpointReference: "runtime://codegraph",
        status: "ENABLED",
        healthStatus: "HEALTHY",
        toolId: "tool-codegraph-read",
        discoverySnapshotDigest: "sha256:mcp-codegraph-discovery-v1",
        compatibility: "MCP 2025-06 · AIOS Tool Contract v1",
        lastTestSummary: test,
        aggregateVersion: 1,
        createdAt: timestamp,
        createdBy: "user-admin",
        updatedAt: timestamp,
        updatedBy: "user-admin",
      },
    ],
    invocations: [],
  };
}

function validateAction(value: unknown): value is ActionDefinition {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.description) &&
    (value.operationType === "READ" || value.operationType === "WRITE") &&
    ["R0", "R1", "R2", "R3"].includes(String(value.riskLevel)) &&
    isNonEmptyString(value.inputSchema) &&
    isNonEmptyString(value.outputSchema) &&
    value.permissionRequirement === "TOOL:USE" &&
    ["NATIVE", "ADAPTER", "NONE"].includes(
      String(value.idempotencySemantics),
    ) &&
    typeof value.reversible === "boolean" &&
    isNonEmptyString(value.definitionDigest)
  );
}

function validateTestSummary(
  value: unknown,
): value is ToolConnectionTestSummary {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    (value.result === "PASSED" || value.result === "FAILED") &&
    typeof value.identityVerified === "boolean" &&
    typeof value.schemaVerified === "boolean" &&
    typeof value.permissionNegativePassed === "boolean" &&
    typeof value.resultValidationPassed === "boolean" &&
    typeof value.secretIsolationPassed === "boolean" &&
    isNonEmptyString(value.evidenceReference) &&
    isNonEmptyString(value.evidenceDigest) &&
    isIsoTimestamp(value.testedAt) &&
    isNonEmptyString(value.testedBy)
  );
}

function validateVersion(value: unknown): value is ToolVersion {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    Number.isInteger(value.versionNumber) &&
    Number(value.versionNumber) > 0 &&
    ["DRAFT", "PUBLISHED", "DEPRECATED", "RETIRED"].includes(
      String(value.status),
    ) &&
    value.schemaVersion === 1 &&
    isNonEmptyString(value.contentDigest) &&
    isNonEmptyString(value.pluginManifestRef) &&
    isNonEmptyString(value.mcpServerId) &&
    (value.credentialReference === undefined ||
      (isNonEmptyString(value.credentialReference) &&
        value.credentialReference.startsWith("secret://"))) &&
    Array.isArray(value.actions) &&
    value.actions.length > 0 &&
    value.actions.every(validateAction) &&
    healthStatuses.has(value.healthStatus as ToolHealthStatus) &&
    isRecord(value.invocationPolicy) &&
    Number.isInteger(value.invocationPolicy.timeoutMs) &&
    Number(value.invocationPolicy.timeoutMs) > 0 &&
    Number.isInteger(value.invocationPolicy.retryLimit) &&
    value.invocationPolicy.unknownResultPolicy === "HUMAN_REVIEW" &&
    Array.isArray(value.testSummaries) &&
    value.testSummaries.every(validateTestSummary) &&
    isIsoTimestamp(value.createdAt) &&
    isNonEmptyString(value.createdBy)
  );
}

function validateTool(value: unknown): value is Tool {
  if (!isRecord(value) || !isRecord(value.scope)) return false;
  return (
    isNonEmptyString(value.id) &&
    value.scope.organizationId === canonicalScope.organizationId &&
    value.scope.workspaceId === canonicalScope.workspaceId &&
    isNonEmptyString(value.code) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.description) &&
    isNonEmptyString(value.ownerId) &&
    toolStatuses.has(value.status as ToolStatus) &&
    (value.publishedVersionId === undefined ||
      isNonEmptyString(value.publishedVersionId)) &&
    Array.isArray(value.versions) &&
    value.versions.length > 0 &&
    value.versions.every(validateVersion) &&
    Number.isInteger(value.aggregateVersion) &&
    isIsoTimestamp(value.createdAt) &&
    isIsoTimestamp(value.updatedAt)
  );
}

function validateServer(value: unknown): value is McpServerRegistration {
  if (!isRecord(value) || !isRecord(value.scope)) return false;
  return (
    isNonEmptyString(value.id) &&
    value.scope.organizationId === canonicalScope.organizationId &&
    value.scope.workspaceId === canonicalScope.workspaceId &&
    isNonEmptyString(value.serverIdentity) &&
    isNonEmptyString(value.displayName) &&
    isNonEmptyString(value.publisher) &&
    isNonEmptyString(value.serverVersion) &&
    (value.transport === "STDIO" ||
      value.transport === "STREAMABLE_HTTP") &&
    isNonEmptyString(value.endpointReference) &&
    (value.credentialReference === undefined ||
      (isNonEmptyString(value.credentialReference) &&
        value.credentialReference.startsWith("secret://"))) &&
    ["DRAFT", "TESTING", "ENABLED", "SUSPENDED"].includes(
      String(value.status),
    ) &&
    healthStatuses.has(value.healthStatus as ToolHealthStatus) &&
    isNonEmptyString(value.toolId) &&
    isNonEmptyString(value.discoverySnapshotDigest) &&
    isNonEmptyString(value.compatibility) &&
    (value.lastTestSummary === undefined ||
      validateTestSummary(value.lastTestSummary)) &&
    Number.isInteger(value.aggregateVersion) &&
    isIsoTimestamp(value.createdAt) &&
    isIsoTimestamp(value.updatedAt)
  );
}

function validateInvocation(value: unknown): value is ToolInvocationResult {
  if (!isRecord(value) || !isRecord(value.scope)) return false;
  const status = String(value.status);
  const validStatus = ["SUCCEEDED", "FAILED", "DENIED", "UNKNOWN"].includes(
    status,
  );
  const validErrorClassification =
    value.errorClassification === undefined ||
    [
      "MCP_UNAVAILABLE",
      "TRANSPORT_TIMEOUT",
      "INVALID_RESULT",
      "PERMISSION_DENIED",
    ].includes(String(value.errorClassification));
  const auditEventTypes = new Set([
    "TOOL_INVOCATION_REQUESTED",
    "TOOL_PERMISSION_ALLOWED",
    "MCP_SESSION_INITIALIZED",
    "TOOL_INVOCATION_SUCCEEDED",
    "TOOL_INVOCATION_FAILED",
    "TOOL_INVOCATION_UNKNOWN",
  ]);
  const validAuditEvents =
    Array.isArray(value.auditEvents) &&
    value.auditEvents.length >= 3 &&
    value.auditEvents.every(
      (event, index) =>
        isRecord(event) &&
        event.sequence === index + 1 &&
        auditEventTypes.has(String(event.eventType)) &&
        isIsoTimestamp(event.occurredAt) &&
        isNonEmptyString(event.summary),
    );
  return (
    isNonEmptyString(value.id) &&
    value.scope.organizationId === canonicalScope.organizationId &&
    value.scope.workspaceId === canonicalScope.workspaceId &&
    isNonEmptyString(value.taskId) &&
    isNonEmptyString(value.runId) &&
    isNonEmptyString(value.actorId) &&
    isNonEmptyString(value.agentId) &&
    isNonEmptyString(value.agentVersionId) &&
    Array.isArray(value.capabilityVersionIds) &&
    value.capabilityVersionIds.length > 0 &&
    value.capabilityVersionIds.every(isNonEmptyString) &&
    isNonEmptyString(value.toolId) &&
    isNonEmptyString(value.toolVersionId) &&
    isNonEmptyString(value.toolVersionDigest) &&
    isNonEmptyString(value.action) &&
    isNonEmptyString(value.actionDigest) &&
    value.operationType === "READ" &&
    value.riskLevel === "R0" &&
    validStatus &&
    isNonEmptyString(value.idempotencyKey) &&
    isNonEmptyString(value.inputDigest) &&
    (value.outputDigest === undefined ||
      isNonEmptyString(value.outputDigest)) &&
    (value.resultReference === undefined ||
      isNonEmptyString(value.resultReference)) &&
    (value.resultExcerpt === undefined ||
      typeof value.resultExcerpt === "string") &&
    isNonEmptyString(value.summary) &&
    validErrorClassification &&
    isIsoTimestamp(value.requestedAt) &&
    isIsoTimestamp(value.completedAt) &&
    typeof value.durationMs === "number" &&
    Number.isFinite(value.durationMs) &&
    value.durationMs >= 0 &&
    isNonEmptyString(value.serverIdentity) &&
    isNonEmptyString(value.serverVersion) &&
    isNonEmptyString(value.schemaDigest) &&
    validAuditEvents &&
    (status !== "SUCCEEDED" ||
      (isNonEmptyString(value.outputDigest) &&
        isNonEmptyString(value.resultReference) &&
        typeof value.resultExcerpt === "string")) &&
    (status === "SUCCEEDED" ||
      isNonEmptyString(value.errorClassification))
  );
}

function isEnvelope(value: unknown): value is ToolStoreEnvelope {
  if (!isRecord(value)) return false;
  if (
    value.schemaVersion !== STORE_SCHEMA_VERSION ||
    !Number.isInteger(value.nextSequence) ||
    Number(value.nextSequence) < 1 ||
    !Array.isArray(value.tools) ||
    !value.tools.every(validateTool) ||
    !Array.isArray(value.mcpServers) ||
    !value.mcpServers.every(validateServer) ||
    !Array.isArray(value.invocations) ||
    !value.invocations.every(validateInvocation)
  ) {
    return false;
  }
  const tools: Tool[] = value.tools;
  const servers: McpServerRegistration[] = value.mcpServers;
  return (
    tools.every((tool) =>
      tool.versions.every((version) =>
        servers.some(({ id }) => id === version.mcpServerId),
      ),
    ) &&
    servers.every((server) =>
      tools.some(({ id }) => id === server.toolId),
    )
  );
}

function validateInput(input: CreateMcpServerInput): void {
  const fields = [
    input.serverIdentity,
    input.displayName,
    input.publisher,
    input.serverVersion,
    input.endpointReference,
    input.toolCode,
    input.toolName,
    input.toolDescription,
    input.actionName,
    input.actionDescription,
  ];
  if (fields.some((value) => !isNonEmptyString(value))) {
    throw new ToolRepositoryError(
      "VALIDATION",
      "MCP Server Identity、Tool 与 ActionDefinition 字段必须完整。",
    );
  }
  if (!/^[a-z][a-z0-9._-]{2,95}$/.test(input.serverIdentity)) {
    throw new ToolRepositoryError(
      "VALIDATION",
      "Server Identity 必须是稳定的小写标识。",
    );
  }
  if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(input.toolCode)) {
    throw new ToolRepositoryError(
      "VALIDATION",
      "Tool Code 必须使用大写字母、数字或下划线。",
    );
  }
  if (!/^[a-z][a-z0-9._-]{2,95}$/.test(input.actionName)) {
    throw new ToolRepositoryError(
      "VALIDATION",
      "Action Name 必须是稳定的小写动作标识。",
    );
  }
  if (input.transport !== "STDIO") {
    throw new ToolRepositoryError(
      "VALIDATION",
      "当前 MVP 仅允许受控 STDIO；Streamable HTTP 将在后续版本通过 TLS、OAuth 与 Egress Gate 开放。",
    );
  }
  if (!input.endpointReference.startsWith("runtime://")) {
    throw new ToolRepositoryError(
      "VALIDATION",
      "STDIO 连接只接受 runtime:// Endpoint Reference，不保存任意宿主命令。",
    );
  }
  if (
    input.credentialReference &&
    !input.credentialReference.startsWith("secret://")
  ) {
    throw new ToolRepositoryError(
      "VALIDATION",
      "Credential 只能保存 secret:// SecretReference，不能保存 Secret Value。",
    );
  }
}

function toActionOption(
  tool: Tool,
  version: ToolVersion,
  action: ActionDefinition,
  server: McpServerRegistration,
): ToolActionSelectionOption {
  return {
    toolId: tool.id,
    toolName: tool.name,
    toolVersionId: version.id,
    toolVersionNumber: version.versionNumber,
    toolVersionDigest: version.contentDigest,
    action: action.name,
    description: action.description,
    operationType: action.operationType,
    riskLevel: action.riskLevel,
    actionDigest: action.definitionDigest,
    mcpServerId: server.id,
    mcpServerName: server.displayName,
  };
}

export function createToolRepository(
  options: CreateToolRepositoryOptions = {},
): ToolRepository {
  const storage = options.storage ?? getBrowserStorage();
  const delay = options.delay ?? defaultDelay;
  const now = options.now ?? (() => new Date().toISOString());

  function load(): ToolStoreEnvelope {
    const raw = storage.getItem(TOOL_STORE_KEY);
    if (raw === null) {
      const initial = seedEnvelope();
      storage.setItem(TOOL_STORE_KEY, JSON.stringify(initial));
      return initial;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isEnvelope(parsed)) throw new Error("invalid envelope");
      return parsed;
    } catch {
      storage.removeItem(TOOL_STORE_KEY);
      throw new ToolRepositoryError(
        "INVALID_STORE",
        "Tool / MCP 本地数据未通过完整性校验，已拒绝加载。",
      );
    }
  }

  function save(envelope: ToolStoreEnvelope): void {
    if (!isEnvelope(envelope)) {
      throw new ToolRepositoryError(
        "INVALID_STORE",
        "Tool / MCP 写入未通过完整性校验。",
      );
    }
    storage.setItem(TOOL_STORE_KEY, JSON.stringify(envelope));
  }

  function context(scope: ToolScope, actor: ToolActor): void {
    validateScope(scope);
    validateActor(actor);
  }

  function findServer(
    envelope: ToolStoreEnvelope,
    serverId: string,
  ): McpServerRegistration {
    const server = envelope.mcpServers.find(({ id }) => id === serverId);
    if (!server) {
      throw new ToolRepositoryError(
        "NOT_FOUND",
        "MCP Server 在当前 Workspace 中不可用。",
      );
    }
    return server;
  }

  function findTool(envelope: ToolStoreEnvelope, toolId: string): Tool {
    const tool = envelope.tools.find(({ id }) => id === toolId);
    if (!tool) {
      throw new ToolRepositoryError(
        "NOT_FOUND",
        "Tool 在当前 Workspace 中不可用。",
      );
    }
    return tool;
  }

  async function publishedOptions(
    scope: ToolScope,
    actor: ToolActor,
  ): Promise<ToolActionSelectionOption[]> {
    context(scope, actor);
    if (!permissionFor(actor).canUse) return [];
    await delay();
    const envelope = load();
    return envelope.tools
      .filter(({ status }) => status === "PUBLISHED")
      .flatMap((tool) => {
        const version = tool.versions.find(
          ({ id }) => id === tool.publishedVersionId,
        );
        if (
          !version ||
          version.status !== "PUBLISHED" ||
          version.healthStatus !== "HEALTHY"
        ) {
          return [];
        }
        const server = envelope.mcpServers.find(
          (candidate) =>
            candidate.id === version.mcpServerId &&
            candidate.status === "ENABLED" &&
            candidate.healthStatus === "HEALTHY",
        );
        if (!server) return [];
        return version.actions
          .filter(
            ({ operationType, riskLevel }) =>
              operationType === "READ" &&
              (riskLevel === "R0" || riskLevel === "R1"),
          )
          .map((action) => toActionOption(tool, version, action, server));
      })
      .sort((left, right) => left.action.localeCompare(right.action));
  }

  return {
    async getPermission(scope, actor) {
      context(scope, actor);
      await delay();
      return permissionFor(actor);
    },

    async listTools(scope, actor) {
      context(scope, actor);
      await delay();
      const envelope = load();
      return envelope.tools
        .map<ToolListItem>((tool) => {
          const version =
            tool.versions.find(({ id }) => id === tool.publishedVersionId) ??
            tool.versions.at(-1)!;
          const server = envelope.mcpServers.find(
            ({ id }) => id === version.mcpServerId,
          );
          return {
            id: tool.id,
            code: tool.code,
            name: tool.name,
            description: tool.description,
            ownerId: tool.ownerId,
            status: tool.status,
            currentVersionId: version.id,
            currentVersionNumber: version.versionNumber,
            versionStatus: version.status,
            healthStatus: version.healthStatus,
            actionCount: version.actions.length,
            maxRiskLevel: maxRisk(version.actions),
            connectionName: server?.displayName ?? version.mcpServerId,
            updatedAt: tool.updatedAt,
          };
        })
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },

    async getTool(scope, actor, toolId) {
      context(scope, actor);
      await delay();
      return cloneMutable(findTool(load(), toolId));
    },

    async getToolSummary(scope, actor) {
      context(scope, actor);
      await delay();
      const tools = load().tools;
      return {
        total: tools.length,
        published: tools.filter(({ status }) => status === "PUBLISHED").length,
        healthy: tools.filter((tool) =>
          tool.versions.some(
            ({ id, healthStatus }) =>
              id === tool.publishedVersionId && healthStatus === "HEALTHY",
          ),
        ).length,
        attention: tools.filter(({ status }) =>
          ["DRAFT", "TESTING", "SUSPENDED"].includes(status),
        ).length,
      };
    },

    async listMcpServers(scope, actor) {
      context(scope, actor);
      await delay();
      return cloneMutable(
        load().mcpServers.sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt),
        ),
      );
    },

    async getMcpServer(scope, actor, serverId) {
      context(scope, actor);
      await delay();
      return cloneMutable(findServer(load(), serverId));
    },

    async getMcpServerSummary(scope, actor) {
      context(scope, actor);
      await delay();
      const servers = load().mcpServers;
      return {
        total: servers.length,
        enabled: servers.filter(({ status }) => status === "ENABLED").length,
        healthy: servers.filter(
          ({ healthStatus }) => healthStatus === "HEALTHY",
        ).length,
        attention: servers.filter(
          ({ status, healthStatus }) =>
            status !== "ENABLED" || healthStatus !== "HEALTHY",
        ).length,
      };
    },

    async createMcpServer(scope, actor, input) {
      context(scope, actor);
      requireManager(actor);
      validateInput(input);
      await delay();
      const envelope = load();
      if (
        envelope.mcpServers.some(
          ({ serverIdentity }) =>
            serverIdentity.toLowerCase() ===
            input.serverIdentity.toLowerCase(),
        ) ||
        envelope.tools.some(
          ({ code }) => code.toLowerCase() === input.toolCode.toLowerCase(),
        )
      ) {
        throw new ToolRepositoryError(
          "CONFLICT",
          "Server Identity 或 Tool Code 已存在。",
        );
      }
      const timestamp = now();
      const sequence = String(envelope.nextSequence).padStart(4, "0");
      const serverId = `mcp-custom-${sequence}`;
      const toolId = `tool-custom-${sequence}`;
      const toolVersionId = `${toolId}-v1`;
      const action: ActionDefinition = {
        name: input.actionName,
        description: input.actionDescription,
        operationType: "READ",
        riskLevel: input.riskLevel,
        inputSchema: `${input.actionName}-input-v1`,
        outputSchema: `${input.actionName}-output-v1`,
        permissionRequirement: "TOOL:USE",
        idempotencySemantics: "NATIVE",
        reversible: true,
        definitionDigest: stableDigest(`${toolVersionId}:${input.actionName}`),
      };
      const tool: Tool = {
        id: toolId,
        scope: cloneMutable(scope),
        code: input.toolCode,
        name: input.toolName,
        description: input.toolDescription,
        ownerId: actor.userId,
        status: "DRAFT",
        versions: [
          {
            id: toolVersionId,
            versionNumber: 1,
            status: "DRAFT",
            schemaVersion: 1,
            contentDigest: stableDigest(
              `${toolVersionId}:${action.definitionDigest}`,
            ),
            pluginManifestRef: `plugin-mcp-${input.serverIdentity}@${input.serverVersion}`,
            mcpServerId: serverId,
            ...(input.credentialReference
              ? { credentialReference: input.credentialReference }
              : {}),
            actions: [action],
            healthStatus: "UNKNOWN",
            invocationPolicy: {
              timeoutMs: 15_000,
              retryLimit: 1,
              unknownResultPolicy: "HUMAN_REVIEW",
            },
            testSummaries: [],
            createdAt: timestamp,
            createdBy: actor.userId,
          },
        ],
        aggregateVersion: 1,
        createdAt: timestamp,
        createdBy: actor.userId,
        updatedAt: timestamp,
        updatedBy: actor.userId,
      };
      const server: McpServerRegistration = {
        id: serverId,
        scope: cloneMutable(scope),
        serverIdentity: input.serverIdentity,
        displayName: input.displayName,
        publisher: input.publisher,
        serverVersion: input.serverVersion,
        transport: input.transport,
        endpointReference: input.endpointReference,
        ...(input.credentialReference
          ? { credentialReference: input.credentialReference }
          : {}),
        status: "DRAFT",
        healthStatus: "UNKNOWN",
        toolId,
        discoverySnapshotDigest: stableDigest(
          `${serverId}:${input.serverVersion}:${action.definitionDigest}`,
        ),
        compatibility: "MCP candidate · AIOS Tool Contract v1",
        aggregateVersion: 1,
        createdAt: timestamp,
        createdBy: actor.userId,
        updatedAt: timestamp,
        updatedBy: actor.userId,
      };
      envelope.nextSequence += 1;
      envelope.tools.push(tool);
      envelope.mcpServers.push(server);
      save(envelope);
      return cloneMutable(server);
    },

    async testMcpServer(scope, actor, serverId) {
      context(scope, actor);
      requireManager(actor);
      await delay();
      const envelope = load();
      const server = findServer(envelope, serverId);
      if (server.status !== "DRAFT" && server.status !== "TESTING") {
        throw new ToolRepositoryError(
          "CONFLICT",
          "只有 Draft 或 Testing MCP Server 可以运行连接测试。",
        );
      }
      const tool = findTool(envelope, server.toolId);
      const version = tool.versions.at(-1)!;
      const timestamp = now();
      const test = passingTest(server.id, actor.userId, timestamp);
      server.status = "TESTING";
      server.healthStatus = "HEALTHY";
      server.lastTestSummary = test;
      server.updatedAt = timestamp;
      server.updatedBy = actor.userId;
      server.aggregateVersion += 1;
      tool.status = "TESTING";
      tool.updatedAt = timestamp;
      tool.updatedBy = actor.userId;
      tool.aggregateVersion += 1;
      version.healthStatus = "HEALTHY";
      version.testSummaries.push(test);
      save(envelope);
      return cloneMutable(server);
    },

    async publishMcpServer(scope, actor, serverId) {
      context(scope, actor);
      requireManager(actor);
      await delay();
      const envelope = load();
      const server = findServer(envelope, serverId);
      const tool = findTool(envelope, server.toolId);
      const version = tool.versions.at(-1)!;
      if (
        server.status !== "TESTING" ||
        server.healthStatus !== "HEALTHY" ||
        server.lastTestSummary?.result !== "PASSED" ||
        !version.testSummaries.some(({ result }) => result === "PASSED")
      ) {
        throw new ToolRepositoryError(
          "TOOL_NOT_PUBLISHABLE",
          "MCP Server 必须通过 Identity、Schema、Permission、Result 与 Secret 隔离测试后才能启用。",
        );
      }
      const timestamp = now();
      server.status = "ENABLED";
      server.updatedAt = timestamp;
      server.updatedBy = actor.userId;
      server.aggregateVersion += 1;
      tool.status = "PUBLISHED";
      tool.publishedVersionId = version.id;
      tool.updatedAt = timestamp;
      tool.updatedBy = actor.userId;
      tool.aggregateVersion += 1;
      version.status = "PUBLISHED";
      version.publishedAt = timestamp;
      version.publishedBy = actor.userId;
      save(envelope);
      return cloneMutable(server);
    },

    async suspendMcpServer(scope, actor, serverId, reason) {
      context(scope, actor);
      requireManager(actor);
      if (reason.trim().length < 8) {
        throw new ToolRepositoryError(
          "VALIDATION",
          "暂停原因至少需要 8 个字符，以便形成可审计证据。",
        );
      }
      await delay();
      const envelope = load();
      const server = findServer(envelope, serverId);
      if (server.status !== "ENABLED") {
        throw new ToolRepositoryError(
          "CONFLICT",
          "只有 Enabled MCP Server 可以暂停。",
        );
      }
      const tool = findTool(envelope, server.toolId);
      const version = tool.versions.find(
        ({ id }) => id === tool.publishedVersionId,
      )!;
      const timestamp = now();
      server.status = "SUSPENDED";
      server.suspendedAt = timestamp;
      server.suspendedBy = actor.userId;
      server.suspensionReason = reason.trim();
      server.updatedAt = timestamp;
      server.updatedBy = actor.userId;
      server.aggregateVersion += 1;
      tool.status = "SUSPENDED";
      tool.updatedAt = timestamp;
      tool.updatedBy = actor.userId;
      tool.aggregateVersion += 1;
      version.suspendedAt = timestamp;
      version.suspendedBy = actor.userId;
      version.suspensionReason = reason.trim();
      save(envelope);
      return cloneMutable(server);
    },

    async resumeMcpServer(scope, actor, serverId) {
      context(scope, actor);
      requireManager(actor);
      await delay();
      const envelope = load();
      const server = findServer(envelope, serverId);
      if (
        server.status !== "SUSPENDED" ||
        server.healthStatus !== "HEALTHY" ||
        server.lastTestSummary?.result !== "PASSED"
      ) {
        throw new ToolRepositoryError(
          "CONFLICT",
          "只有通过测试且 Health 为 Healthy 的 Suspended MCP Server 可以恢复。",
        );
      }
      const tool = findTool(envelope, server.toolId);
      const timestamp = now();
      server.status = "ENABLED";
      delete server.suspendedAt;
      delete server.suspendedBy;
      delete server.suspensionReason;
      server.updatedAt = timestamp;
      server.updatedBy = actor.userId;
      server.aggregateVersion += 1;
      tool.status = "PUBLISHED";
      tool.updatedAt = timestamp;
      tool.updatedBy = actor.userId;
      tool.aggregateVersion += 1;
      save(envelope);
      return cloneMutable(server);
    },

    listPublishedActionOptions: publishedOptions,

    async resolvePublishedActionOption(
      scope,
      actor,
      toolVersionId,
      action,
    ) {
      const option = (await publishedOptions(scope, actor)).find(
        (candidate) =>
          candidate.toolVersionId === toolVersionId &&
          candidate.action === action,
      );
      if (!option) {
        throw new ToolRepositoryError(
          "NOT_FOUND",
          "ToolVersion / Action 当前未发布、未授权或 Health 不可用。",
        );
      }
      return option;
    },

    async recordInvocation(scope, actor, result) {
      context(scope, actor);
      requireManager(actor);
      await delay();
      if (
        !validateInvocation(result) ||
        result.scope.organizationId !== scope.organizationId ||
        result.scope.workspaceId !== scope.workspaceId ||
        result.actorId !== actor.userId
      ) {
        throw new ToolRepositoryError(
          "VALIDATION",
          "ToolInvocationResult 与当前 Workspace、Actor 或结果契约不一致。",
        );
      }
      const envelope = load();
      const tool = findTool(envelope, result.toolId);
      const version = tool.versions.find(
        ({ id }) => id === result.toolVersionId,
      );
      const action = version?.actions.find(
        ({ name }) => name === result.action,
      );
      if (
        !version ||
        !action ||
        version.contentDigest !== result.toolVersionDigest ||
        action.definitionDigest !== result.actionDigest ||
        action.operationType !== result.operationType ||
        action.riskLevel !== result.riskLevel
      ) {
        throw new ToolRepositoryError(
          "CONFLICT",
          "ToolInvocationResult 未命中固定 ToolVersion / ActionDefinition。",
        );
      }
      const repeated = envelope.invocations.find(
        ({ idempotencyKey }) => idempotencyKey === result.idempotencyKey,
      );
      if (repeated) {
        if (
          repeated.id !== result.id ||
          repeated.inputDigest !== result.inputDigest
        ) {
          throw new ToolRepositoryError(
            "CONFLICT",
            "IdempotencyKey 已绑定不同的 Tool Invocation。",
          );
        }
        return cloneMutable(repeated);
      }
      envelope.invocations.push(cloneMutable(result));
      save(envelope);
      return cloneMutable(result);
    },

    async listTaskInvocations(scope, actor, taskId) {
      context(scope, actor);
      if (!isNonEmptyString(taskId)) {
        throw new ToolRepositoryError(
          "VALIDATION",
          "TaskId 不能为空。",
        );
      }
      await delay();
      return cloneMutable(
        load()
          .invocations.filter(
            (invocation) => invocation.taskId === taskId,
          )
          .sort((left, right) =>
            left.requestedAt.localeCompare(right.requestedAt),
          ),
      );
    },
  };
}

function repository(): ToolRepository {
  return createToolRepository();
}

export const getToolPermission = (
  scope: ToolScope,
  actor: ToolActor,
) => repository().getPermission(scope, actor);
export const listTools = (scope: ToolScope, actor: ToolActor) =>
  repository().listTools(scope, actor);
export const getTool = (
  scope: ToolScope,
  actor: ToolActor,
  toolId: string,
) => repository().getTool(scope, actor, toolId);
export const getToolSummary = (scope: ToolScope, actor: ToolActor) =>
  repository().getToolSummary(scope, actor);
export const listMcpServers = (scope: ToolScope, actor: ToolActor) =>
  repository().listMcpServers(scope, actor);
export const getMcpServer = (
  scope: ToolScope,
  actor: ToolActor,
  serverId: string,
) => repository().getMcpServer(scope, actor, serverId);
export const getMcpServerSummary = (scope: ToolScope, actor: ToolActor) =>
  repository().getMcpServerSummary(scope, actor);
export const createMcpServer = (
  scope: ToolScope,
  actor: ToolActor,
  input: CreateMcpServerInput,
) => repository().createMcpServer(scope, actor, input);
export const testMcpServer = (
  scope: ToolScope,
  actor: ToolActor,
  serverId: string,
) => repository().testMcpServer(scope, actor, serverId);
export const publishMcpServer = (
  scope: ToolScope,
  actor: ToolActor,
  serverId: string,
) => repository().publishMcpServer(scope, actor, serverId);
export const suspendMcpServer = (
  scope: ToolScope,
  actor: ToolActor,
  serverId: string,
  reason: string,
) => repository().suspendMcpServer(scope, actor, serverId, reason);
export const resumeMcpServer = (
  scope: ToolScope,
  actor: ToolActor,
  serverId: string,
) => repository().resumeMcpServer(scope, actor, serverId);
export const listPublishedToolActionOptions = (
  scope: ToolScope,
  actor: ToolActor,
) => repository().listPublishedActionOptions(scope, actor);
export const resolvePublishedToolActionOption = (
  scope: ToolScope,
  actor: ToolActor,
  toolVersionId: string,
  action: string,
) =>
  repository().resolvePublishedActionOption(
    scope,
    actor,
    toolVersionId,
    action,
  );
export const recordToolInvocation = (
  scope: ToolScope,
  actor: ToolActor,
  result: ToolInvocationResult,
) => repository().recordInvocation(scope, actor, result);
export const listTaskToolInvocations = (
  scope: ToolScope,
  actor: ToolActor,
  taskId: string,
) => repository().listTaskInvocations(scope, actor, taskId);
