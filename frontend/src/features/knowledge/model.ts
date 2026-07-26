export interface KnowledgeScope {
  organizationId: string;
  workspaceId: string;
}

export interface KnowledgeActor {
  userId: string;
}

export type KnowledgeSourceType =
  | "DOCUMENT"
  | "CODE"
  | "SOP"
  | "HISTORY"
  | "EXPERIENCE";

export type KnowledgeClassification =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL";

export type KnowledgeItemStatus = "ACTIVE" | "ARCHIVED";

export type KnowledgeEffectiveStatus =
  | "DRAFT"
  | "EFFECTIVE"
  | "INVALIDATED";

export type KnowledgeIndexStatus =
  | "PENDING"
  | "INDEXING"
  | "READY"
  | "FAILED"
  | "STALE";

export type KnowledgePipelineStageName =
  | "VERIFY"
  | "PARSE"
  | "CHUNK"
  | "EMBED"
  | "INDEX"
  | "RETRIEVAL_VALIDATE";

export interface KnowledgeSourceDescriptor {
  sourceType: KnowledgeSourceType;
  sourceLocation: string;
  sourceAuthority: string;
}

export interface KnowledgeApplicableScope {
  scopeType: "WORKSPACE";
  scopeId: string;
  purpose: "software_engineering_tasks";
  scopeDigest: string;
}

export interface KnowledgeRawContentReference {
  storageProvider: "MOCK_CONTENT_STORE";
  objectKey: string;
  storageVersion: string;
  mediaType: "text/plain" | "text/markdown";
  sizeBytes: number;
  fileName: string;
}

export interface KnowledgeValidationSummary {
  sourceVerified: boolean;
  structureValid: boolean;
  retrievalPassed: boolean;
  permissionNegativePassed: boolean;
  chunkCount: number;
  citationCoverage: number;
}

export interface KnowledgePipelineStage {
  name: KnowledgePipelineStageName;
  status: "SUCCEEDED" | "FAILED";
  processorVersion: string;
  summary: string;
  completedAt: string;
}

export interface KnowledgeVersion {
  id: string;
  versionNumber: number;
  effectiveStatus: KnowledgeEffectiveStatus;
  indexStatus: KnowledgeIndexStatus;
  rawContentReference: KnowledgeRawContentReference;
  contentDigest: string;
  contentPreview: string;
  parserVersion: "mock-parser-v1";
  chunkerVersion: "mock-chunker-v1";
  embeddingModelVersion: "mock-embedding-v1";
  indexVersion: number;
  validationSummary: KnowledgeValidationSummary;
  pipelineStages: KnowledgePipelineStage[];
  supersedesVersionId?: string;
  createdAt: string;
  createdBy: string;
  publishedAt?: string;
  publishedBy?: string;
  invalidatedAt?: string;
  invalidatedBy?: string;
  invalidationReason?: string;
}

export type CorrectionStatus =
  | "OPEN"
  | "ACCEPTED"
  | "REJECTED"
  | "CLOSED";

export interface KnowledgeCorrectionRequest {
  id: string;
  targetVersionId: string;
  submittedBy: string;
  reason: string;
  evidenceReference: string;
  evidenceDigest: string;
  status: CorrectionStatus;
  createdAt: string;
}

export interface KnowledgeItem {
  id: string;
  scope: KnowledgeScope;
  code: string;
  title: string;
  description: string;
  source: KnowledgeSourceDescriptor;
  ownerId: string;
  classification: KnowledgeClassification;
  status: KnowledgeItemStatus;
  effectiveVersionId?: string;
  applicableScopes: KnowledgeApplicableScope[];
  versions: KnowledgeVersion[];
  correctionRequests: KnowledgeCorrectionRequest[];
  referencedTaskIds: string[];
  referencedCapabilityIds: string[];
  aggregateVersion: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  archivedAt?: string;
}

export interface KnowledgeListItem {
  id: string;
  code: string;
  title: string;
  sourceType: KnowledgeSourceType;
  sourceLocation: string;
  ownerId: string;
  classification: KnowledgeClassification;
  status: KnowledgeItemStatus;
  effectiveStatus: KnowledgeEffectiveStatus;
  indexStatus: KnowledgeIndexStatus;
  currentVersionNumber: number;
  currentVersionId: string;
  referencedTaskCount: number;
  referencedCapabilityCount: number;
  openCorrectionCount: number;
  updatedAt: string;
}

export interface KnowledgeQuery {
  keyword?: string;
  effectiveStatus?: KnowledgeEffectiveStatus;
  indexStatus?: KnowledgeIndexStatus;
  classification?: KnowledgeClassification;
  page?: number;
  pageSize?: number;
}

export interface KnowledgePage {
  total: number;
  page: number;
  pageSize: number;
  items: KnowledgeListItem[];
}

export interface KnowledgeSummary {
  total: number;
  effective: number;
  draft: number;
  attention: number;
}

export interface KnowledgePermissionDecision {
  canRead: boolean;
  canManage: boolean;
  canSubmitCorrection: boolean;
  reason: string;
}

export interface RegisterKnowledgeInput {
  code: string;
  title: string;
  description: string;
  sourceType: KnowledgeSourceType;
  sourceLocation: string;
  sourceAuthority: string;
  ownerId: string;
  classification: KnowledgeClassification;
  purpose: "software_engineering_tasks";
  fileName: string;
  mediaType: "text/plain" | "text/markdown";
  content: string;
  contentDigest: string;
}

export interface CreateKnowledgeVersionInput {
  fileName: string;
  mediaType: "text/plain" | "text/markdown";
  content: string;
  contentDigest: string;
}

export interface SubmitCorrectionInput {
  targetVersionId: string;
  reason: string;
  evidenceReference: string;
  evidenceDigest: string;
}

export interface KnowledgeCitation {
  knowledgeVersionId: string;
  contentLocation: string;
  citationDigest: string;
}

export interface KnowledgeRetrievalResult {
  knowledgeId: string;
  knowledgeTitle: string;
  versionId: string;
  versionNumber: number;
  excerpt: string;
  score: number;
  sparseScore: number;
  denseScore: number;
  citation: KnowledgeCitation;
}

export interface KnowledgeRetrievalResponse {
  outcome: "RESULTS" | "EMPTY";
  query: string;
  purpose: "software_engineering_tasks";
  permissionDigest: string;
  scopeDigest: string;
  retrievalMode: "DETERMINISTIC_MOCK_HYBRID";
  results: KnowledgeRetrievalResult[];
  executedAt: string;
}
