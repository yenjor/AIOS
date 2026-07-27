export interface ToolScope {
  organizationId: string;
  workspaceId: string;
}

export interface ToolActor {
  userId: string;
}

export type ToolStatus =
  | "DRAFT"
  | "TESTING"
  | "PUBLISHED"
  | "SUSPENDED"
  | "RETIRED";

export type ToolVersionStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "DEPRECATED"
  | "RETIRED";

export type ToolHealthStatus =
  | "HEALTHY"
  | "DEGRADED"
  | "UNAVAILABLE"
  | "UNKNOWN";

export type McpTransport = "STDIO" | "STREAMABLE_HTTP";

export type McpServerStatus =
  | "DRAFT"
  | "TESTING"
  | "ENABLED"
  | "SUSPENDED";

export interface ActionDefinition {
  name: string;
  description: string;
  operationType: "READ" | "WRITE";
  riskLevel: "R0" | "R1" | "R2" | "R3";
  inputSchema: string;
  outputSchema: string;
  permissionRequirement: "TOOL:USE";
  idempotencySemantics: "NATIVE" | "ADAPTER" | "NONE";
  reversible: boolean;
  definitionDigest: string;
}

export interface ToolConnectionTestSummary {
  id: string;
  result: "PASSED" | "FAILED";
  identityVerified: boolean;
  schemaVerified: boolean;
  permissionNegativePassed: boolean;
  resultValidationPassed: boolean;
  secretIsolationPassed: boolean;
  evidenceReference: string;
  evidenceDigest: string;
  testedAt: string;
  testedBy: string;
}

export interface ToolVersion {
  id: string;
  versionNumber: number;
  status: ToolVersionStatus;
  schemaVersion: 1;
  contentDigest: string;
  pluginManifestRef: string;
  mcpServerId: string;
  credentialReference?: string;
  actions: ActionDefinition[];
  healthStatus: ToolHealthStatus;
  invocationPolicy: {
    timeoutMs: number;
    retryLimit: number;
    unknownResultPolicy: "HUMAN_REVIEW";
  };
  testSummaries: ToolConnectionTestSummary[];
  createdAt: string;
  createdBy: string;
  publishedAt?: string;
  publishedBy?: string;
  suspendedAt?: string;
  suspendedBy?: string;
  suspensionReason?: string;
}

export interface Tool {
  id: string;
  scope: ToolScope;
  code: string;
  name: string;
  description: string;
  ownerId: string;
  status: ToolStatus;
  publishedVersionId?: string;
  versions: ToolVersion[];
  aggregateVersion: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface McpServerRegistration {
  id: string;
  scope: ToolScope;
  serverIdentity: string;
  displayName: string;
  publisher: string;
  serverVersion: string;
  transport: McpTransport;
  endpointReference: string;
  credentialReference?: string;
  status: McpServerStatus;
  healthStatus: ToolHealthStatus;
  toolId: string;
  discoverySnapshotDigest: string;
  compatibility: string;
  lastTestSummary?: ToolConnectionTestSummary;
  aggregateVersion: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  suspendedAt?: string;
  suspendedBy?: string;
  suspensionReason?: string;
}

export interface ToolPermissionDecision {
  canRead: boolean;
  canUse: boolean;
  canManage: boolean;
  canPublish: boolean;
  reason: string;
}

export interface ToolListItem {
  id: string;
  code: string;
  name: string;
  description: string;
  ownerId: string;
  status: ToolStatus;
  currentVersionId: string;
  currentVersionNumber: number;
  versionStatus: ToolVersionStatus;
  healthStatus: ToolHealthStatus;
  actionCount: number;
  maxRiskLevel: ActionDefinition["riskLevel"];
  connectionName: string;
  updatedAt: string;
}

export interface ToolSummary {
  total: number;
  published: number;
  healthy: number;
  attention: number;
}

export interface McpServerSummary {
  total: number;
  enabled: number;
  healthy: number;
  attention: number;
}

export interface CreateMcpServerInput {
  serverIdentity: string;
  displayName: string;
  publisher: string;
  serverVersion: string;
  transport: McpTransport;
  endpointReference: string;
  credentialReference?: string;
  toolCode: string;
  toolName: string;
  toolDescription: string;
  actionName: string;
  actionDescription: string;
  riskLevel: "R0" | "R1";
}

export interface ToolActionSelectionOption {
  toolId: string;
  toolName: string;
  toolVersionId: string;
  toolVersionNumber: number;
  toolVersionDigest: string;
  action: string;
  description: string;
  operationType: "READ" | "WRITE";
  riskLevel: ActionDefinition["riskLevel"];
  actionDigest: string;
  mcpServerId: string;
  mcpServerName: string;
}

export type ToolInvocationStatus =
  | "SUCCEEDED"
  | "FAILED"
  | "DENIED"
  | "UNKNOWN";

export interface ToolInvocationAuditEvent {
  sequence: number;
  eventType:
    | "TOOL_INVOCATION_REQUESTED"
    | "TOOL_PERMISSION_ALLOWED"
    | "MCP_SESSION_INITIALIZED"
    | "TOOL_INVOCATION_SUCCEEDED"
    | "TOOL_INVOCATION_FAILED"
    | "TOOL_INVOCATION_UNKNOWN";
  occurredAt: string;
  summary: string;
}

export interface ToolInvocationResult {
  id: string;
  scope: ToolScope;
  taskId: string;
  runId: string;
  actorId: string;
  agentId: string;
  agentVersionId: string;
  capabilityVersionIds: string[];
  toolId: string;
  toolVersionId: string;
  toolVersionDigest: string;
  action: string;
  actionDigest: string;
  operationType: "READ";
  riskLevel: "R0";
  status: ToolInvocationStatus;
  idempotencyKey: string;
  inputDigest: string;
  outputDigest?: string;
  resultReference?: string;
  resultExcerpt?: string;
  summary: string;
  errorClassification?:
    | "MCP_UNAVAILABLE"
    | "TRANSPORT_TIMEOUT"
    | "INVALID_RESULT"
    | "PERMISSION_DENIED";
  requestedAt: string;
  completedAt: string;
  durationMs: number;
  serverIdentity: string;
  serverVersion: string;
  schemaDigest: string;
  auditEvents: ToolInvocationAuditEvent[];
}

export interface InvokeCodeGraphContextInput {
  scope: ToolScope;
  actorId: string;
  humanOwnerUserId: string;
  taskId: string;
  runId: string;
  agentId: string;
  agentVersionId: string;
  capabilityVersionIds: string[];
  executionPackageDigest: string;
  toolVersionId: "tool-codegraph-read-v1";
  toolVersionDigest: "sha256:tool-codegraph-read-v1";
  action: "codegraph.context";
  actionDigest: "sha256:codegraph-context-action-v1";
  operationType: "READ";
  riskLevel: "R0";
  idempotencyKey: string;
  query: string;
}
