import type { ArtifactSection } from "@/features/artifact/model";

export interface ModelInvocationScope {
  organizationId: string;
  workspaceId: string;
}

export type ModelInvocationStatus = "SUCCEEDED" | "FAILED" | "UNKNOWN";

export type ModelInvocationErrorClassification =
  | "GATEWAY_NOT_CONFIGURED"
  | "GATEWAY_UNAVAILABLE"
  | "GATEWAY_TIMEOUT"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "OUTPUT_INVALID";

export type ModelInvocationAuditEventType =
  | "MODEL_INVOCATION_REQUESTED"
  | "MODEL_POLICY_ALLOWED"
  | "MODEL_GATEWAY_DISPATCHED"
  | "MODEL_RESPONSE_RECEIVED"
  | "MODEL_OUTPUT_VALIDATED"
  | "MODEL_INVOCATION_FAILED"
  | "MODEL_INVOCATION_UNKNOWN";

export interface ModelInvocationAuditEvent {
  sequence: number;
  eventType: ModelInvocationAuditEventType;
  occurredAt: string;
  summary: string;
}

export interface ModelTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface KnowledgeVersionInput {
  versionId: string;
  digest: string;
}

export interface InvokeTechnicalDesignModelInput {
  scope: ModelInvocationScope;
  actorId: string;
  humanOwnerUserId: string;
  taskId: string;
  runId: string;
  agentId: string;
  agentVersionId: string;
  capabilityVersionId: string;
  capabilityVersionDigest: string;
  promptVersionId: string;
  promptVersionDigest: string;
  promptVariableSchema: string;
  promptOutputSchema: string;
  modelPolicyProfile: string;
  executionPackageDigest: string;
  workflowVersionId: string;
  toolInvocationId: string;
  toolResultReference: string;
  toolOutputDigest: string;
  toolResultExcerpt: string;
  title: string;
  goal: string;
  goalSummary: string;
  constraints: string[];
  outOfScope: string[];
  completionCriteria: string[];
  knowledgeVersions: KnowledgeVersionInput[];
  idempotencyKey: string;
}

export interface ModelInvocationResult {
  id: string;
  scope: ModelInvocationScope;
  taskId: string;
  runId: string;
  actorId: string;
  agentId: string;
  agentVersionId: string;
  capabilityVersionId: string;
  promptVersionId: string;
  modelPolicyProfile: string;
  modelAlias: string;
  resolvedModel?: string;
  provider?: string;
  status: ModelInvocationStatus;
  idempotencyKey: string;
  inputDigest: string;
  promptDigest: string;
  outputDigest?: string;
  resultReference?: string;
  sections?: ArtifactSection[];
  summary: string;
  errorClassification?: ModelInvocationErrorClassification;
  requestedAt: string;
  completedAt: string;
  durationMs: number;
  usage?: ModelTokenUsage;
  auditEvents: ModelInvocationAuditEvent[];
}
