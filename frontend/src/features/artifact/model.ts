export interface ArtifactScope {
  organizationId: string;
  workspaceId: string;
}

export interface ArtifactActor {
  userId: string;
}

export interface ArtifactVersionIdentity {
  artifactId: string;
  versionId: string;
  versionNumber: number;
  digest: string;
}

export type ArtifactReviewStatus = "PENDING_REVIEW" | "ACCEPTED";

export interface ArtifactSection {
  title:
    | "目标理解"
    | "范围与不做事项"
    | "影响模块与文件"
    | "技术决策"
    | "风险"
    | "测试建议"
    | "回退考虑"
    | "知识库引用";
  paragraphs: string[];
}

export interface ArtifactValidationResult {
  id: string;
  name:
    | "Artifact 结构完整性"
    | "知识库引用可追溯"
    | "Reviewer 人工验收";
  status: "PASSED" | "PENDING";
  summary: string;
}

export interface ArtifactCitation {
  knowledgeVersionId: string;
  locator: string;
  digest: string;
}

export interface ArtifactProvenance {
  taskId: string;
  runId: string;
  agentVersionId: string;
  capabilityVersionIds: string[];
  knowledgeVersionIds: string[];
  workflowVersionId: string;
  toolVersionIds: string[];
  promptVersionId?: string;
  modelPolicyProfile?: string;
  modelInvocationId?: string;
  modelAlias?: string;
  resolvedModel?: string;
  modelOutputDigest?: string;
  generatedAt: string;
  contentDigest: string;
}

export interface TechnicalSolutionArtifact {
  id: string;
  scope: ArtifactScope;
  title: string;
  artifactType: "技术方案";
  status: ArtifactReviewStatus;
  version: ArtifactVersionIdentity;
  sections: ArtifactSection[];
  validationResults: ArtifactValidationResult[];
  citations: ArtifactCitation[];
  provenance: ArtifactProvenance;
  reviewerUserIds: string[];
  acceptedByUserId?: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TechnicalSolutionArtifactDraft {
  scope: ArtifactScope;
  taskId: string;
  runId: string;
  title: string;
  sections: ArtifactSection[];
  citations: ArtifactCitation[];
  agentVersionId: string;
  capabilityVersionIds: string[];
  knowledgeVersionIds: string[];
  workflowVersionId: string;
  toolVersionIds: string[];
  promptVersionId: string;
  modelPolicyProfile: string;
  modelInvocationId: string;
  modelAlias: string;
  resolvedModel: string;
  modelOutputDigest: string;
  reviewerUserIds: string[];
  contentDigest: string;
}
