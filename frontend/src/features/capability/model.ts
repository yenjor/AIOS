export interface CapabilityScope {
  organizationId: string;
  workspaceId: string;
}

export interface CapabilityActor {
  userId: string;
}

export type CapabilityStatus = "ACTIVE" | "ARCHIVED";

export type CapabilityReleaseStatus =
  | "DRAFT"
  | "VALIDATING"
  | "IN_REVIEW"
  | "PUBLISHED"
  | "SUSPENDED"
  | "DEPRECATED"
  | "RETIRED";

export type CapabilityTaskType =
  | "GENERATE_TECHNICAL_DESIGN"
  | "ANALYZE_REQUIREMENT"
  | "CODE_REVIEW"
  | "AUTOMATED_TEST";

export interface CapabilityVersionRef {
  kind: "CAPABILITY";
  objectId: string;
  versionId: string;
  versionNumber: number;
  digest: string;
}

export interface SkillDefinition {
  name: string;
  taskTypes: CapabilityTaskType[];
  purpose: string;
  inputContract: string;
  outputContract: string;
  stepIntents: string[];
  knownLimitations: string[];
  riskClassification: "R0" | "R1" | "R2";
}

export interface PromptTemplateRef {
  promptId: string;
  versionId: string;
  versionNumber: number;
  digest: string;
  variableSchema: string;
  outputSchema: string;
}

export interface ModelPolicy {
  profile: string;
  dataResidency: "organization_policy";
  structuredOutputRequired: boolean;
  toolCallingRequired: boolean;
  fallbackAllowed: boolean;
  costCeiling: "workspace_policy";
}

export interface KnowledgeRequirement {
  purpose: "software_engineering_tasks";
  classificationCeiling: "INTERNAL";
  scope: "CURRENT_WORKSPACE";
  effectiveRequired: boolean;
  citationRequired: boolean;
}

export interface ToolRequirement {
  toolId: string;
  toolVersionId: string;
  action: string;
  riskLevel: "R0" | "R1" | "R2";
  required: boolean;
  targetDigest: string;
}

export interface WorkflowVersionRef {
  workflowId: string;
  versionId: string;
  versionNumber: number;
  digest: string;
}

export interface PermissionRequirement {
  resource: "WORKSPACE" | "KNOWLEDGE" | "TOOL" | "ARTIFACT";
  action: "READ" | "USE" | "CREATE_DRAFT";
  scope: "CURRENT_WORKSPACE";
}

export interface ArtifactContract {
  artifactType:
    | "TECHNICAL_DESIGN"
    | "REQUIREMENT_ANALYSIS"
    | "CODE_REVIEW_REPORT"
    | "TEST_REPORT";
  requiresReview: true;
  completionCriteriaMapping: string[];
}

export interface EvaluationGate {
  sampleSetVersion: string;
  requiredResult: "PASSED";
  minimumRuns: number;
  qualityThreshold: number;
  safetyRequired: true;
  citationRequired: boolean;
  gateDigest: string;
}

export interface FailurePolicy {
  retryLimit: number;
  missingKnowledge: "NEED_INPUT";
  permissionDenied: "STOP";
  unknownToolResult: "HUMAN_REVIEW";
  modelFailure: "BOUNDED_RETRY_THEN_HUMAN";
}

export interface EvaluationSummary {
  id: string;
  result: "PASSED" | "FAILED" | "BLOCKED";
  sampleSetVersion: string;
  qualityScore: number;
  safetyPassed: boolean;
  artifactContractPassed: boolean;
  permissionNegativePassed: boolean;
  evidenceReference: string;
  evidenceDigest: string;
  evaluatedAt: string;
  evaluatedBy: string;
}

export interface CapabilityVersion {
  id: string;
  versionNumber: number;
  status: CapabilityReleaseStatus;
  schemaVersion: 1;
  contentDigest: string;
  skillDefinition: SkillDefinition;
  promptTemplateRef: PromptTemplateRef;
  modelPolicy: ModelPolicy;
  knowledgeRequirements: KnowledgeRequirement[];
  toolRequirements: ToolRequirement[];
  workflowVersionRef: WorkflowVersionRef;
  permissionRequirements: PermissionRequirement[];
  artifactContract: ArtifactContract;
  evaluationGate: EvaluationGate;
  failurePolicy: FailurePolicy;
  evaluationSummaries: EvaluationSummary[];
  supersedesVersionId?: string;
  createdAt: string;
  createdBy: string;
  reviewedAt?: string;
  reviewedBy?: string;
  publishedAt?: string;
  publishedBy?: string;
  suspendedAt?: string;
  suspendedBy?: string;
  suspensionReason?: string;
  deprecatedAt?: string;
  deprecatedBy?: string;
}

export interface Capability {
  id: string;
  scope: CapabilityScope;
  code: string;
  name: string;
  purpose: string;
  ownerId: string;
  status: CapabilityStatus;
  publishedVersionId?: string;
  versions: CapabilityVersion[];
  referencedTaskIds: string[];
  aggregateVersion: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface CapabilityListItem {
  id: string;
  code: string;
  name: string;
  purpose: string;
  ownerId: string;
  taskTypes: CapabilityTaskType[];
  rootStatus: CapabilityStatus;
  releaseStatus: CapabilityReleaseStatus;
  currentVersionId: string;
  currentVersionNumber: number;
  publishedVersionId?: string;
  evaluationResult?: EvaluationSummary["result"];
  dependencyCount: number;
  taskUsageCount: number;
  updatedAt: string;
}

export interface CapabilityQuery {
  keyword?: string;
  releaseStatus?: CapabilityReleaseStatus;
  taskType?: CapabilityTaskType;
  page?: number;
  pageSize?: number;
}

export interface CapabilityPage {
  total: number;
  page: number;
  pageSize: number;
  items: CapabilityListItem[];
}

export interface CapabilitySummary {
  total: number;
  published: number;
  inGovernance: number;
  attention: number;
}

export interface CapabilityPermissionDecision {
  canRead: boolean;
  canUse: boolean;
  canManage: boolean;
  canReviewAndPublish: boolean;
  reason: string;
}

export interface CreateCapabilityInput {
  code: string;
  name: string;
  purpose: string;
  ownerId: string;
  taskType: CapabilityTaskType;
  promptId: string;
  modelProfile: string;
  workflowId: string;
  artifactType: ArtifactContract["artifactType"];
  includeKnowledge: boolean;
  toolAction?: string;
}

export interface CapabilitySelectionOption {
  capabilityId: string;
  capabilityName: string;
  purpose: string;
  taskType: CapabilityTaskType;
  versionRef: CapabilityVersionRef;
  modelProfile: string;
  workflowVersionId: string;
  knowledgeRequired: boolean;
  toolActions: string[];
}

export function toCapabilityVersionRef(
  capability: Capability,
  version: CapabilityVersion,
): CapabilityVersionRef {
  return {
    kind: "CAPABILITY",
    objectId: capability.id,
    versionId: version.id,
    versionNumber: version.versionNumber,
    digest: version.contentDigest,
  };
}
