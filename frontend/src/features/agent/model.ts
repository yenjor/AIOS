import type {
  CapabilityTaskType,
  CapabilityVersionRef,
} from "@/features/capability/model";

export interface AgentScope {
  organizationId: string;
  workspaceId: string;
}

export interface AgentActor {
  userId: string;
}

export type AgentStatus =
  | "DRAFT"
  | "TESTING"
  | "ENABLED"
  | "SUSPENDED"
  | "DISABLED";

export type AgentVersionStatus = "DRAFT" | "PUBLISHED" | "RETIRED";

export type AutonomyLevel = "L0建议" | "L1辅助" | "L2受控执行";

export interface AgentVersionRef {
  kind: "AGENT";
  objectId: string;
  versionId: string;
  versionNumber: number;
  digest: string;
}

export interface AgentProfile {
  jobTitle: string;
  jobFamily: "software_engineering";
  roleDescription: string;
  acceptedTaskTypes: CapabilityTaskType[];
  expectedArtifactTypes: string[];
  responsibilityBoundary: string;
  humanCollaboration: string;
  escalationPolicy: string;
  dataClassificationCeiling: "INTERNAL";
  permanentProhibitions: string[];
}

export interface WorkspaceAssignment {
  workspaceId: string;
  assignmentType: "SERVES";
  scopeDigest: string;
}

export interface KnowledgeScopeAssignment {
  organizationId: string;
  workspaceId: string;
  purpose: "software_engineering_tasks";
  classificationCeiling: "INTERNAL";
  citationRequired: true;
  scopeDigest: string;
}

export interface ToolGrantReference {
  toolId: string;
  toolVersionId: string;
  action: string;
  operationType: "READ";
  riskCeiling: "R0" | "R1";
  scopeDigest: string;
}

export interface AgentPermissionRequirement {
  resource: "TASK" | "KNOWLEDGE" | "TOOL" | "ARTIFACT";
  action: "READ" | "USE" | "CREATE_DRAFT";
  scope: "CURRENT_WORKSPACE";
}

export interface AgentTestSummary {
  id: string;
  result: "PASSED" | "FAILED" | "BLOCKED";
  capabilityAssignmentsValid: boolean;
  knowledgeScopeValid: boolean;
  toolGrantValid: boolean;
  permissionNegativePassed: boolean;
  artifactDraftPassed: boolean;
  promptInjectionPassed: boolean;
  evidenceReference: string;
  evidenceDigest: string;
  testedAt: string;
  testedBy: string;
}

export interface AgentVersion {
  id: string;
  versionNumber: number;
  status: AgentVersionStatus;
  schemaVersion: 1;
  contentDigest: string;
  humanOwnerId: string;
  profile: AgentProfile;
  workspaceAssignments: WorkspaceAssignment[];
  capabilityAssignments: CapabilityVersionRef[];
  knowledgeScopeAssignments: KnowledgeScopeAssignment[];
  toolGrantReferences: ToolGrantReference[];
  autonomyLevel: AutonomyLevel;
  permissionRequirements: AgentPermissionRequirement[];
  testSummaries: AgentTestSummary[];
  supersedesVersionId?: string;
  createdAt: string;
  createdBy: string;
  publishedAt?: string;
  publishedBy?: string;
  retiredAt?: string;
  retiredBy?: string;
}

export interface Agent {
  id: string;
  scope: AgentScope;
  code: string;
  name: string;
  roleDescription: string;
  humanOwnerId: string;
  status: AgentStatus;
  publishedVersionId?: string;
  versions: AgentVersion[];
  referencedTaskIds: string[];
  aggregateVersion: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  suspendedAt?: string;
  suspendedBy?: string;
  suspensionReason?: string;
  disabledAt?: string;
  disabledBy?: string;
}

export interface AgentListItem {
  id: string;
  code: string;
  name: string;
  roleDescription: string;
  humanOwnerId: string;
  status: AgentStatus;
  currentVersionId: string;
  currentVersionNumber: number;
  versionStatus: AgentVersionStatus;
  autonomyLevel: AutonomyLevel;
  taskTypes: CapabilityTaskType[];
  capabilityCount: number;
  taskUsageCount: number;
  testResult?: AgentTestSummary["result"];
  updatedAt: string;
}

export interface AgentQuery {
  keyword?: string;
  status?: AgentStatus;
  autonomyLevel?: AutonomyLevel;
  taskType?: CapabilityTaskType;
  page?: number;
  pageSize?: number;
}

export interface AgentPage {
  total: number;
  page: number;
  pageSize: number;
  items: AgentListItem[];
}

export interface AgentSummary {
  total: number;
  enabled: number;
  testing: number;
  attention: number;
}

export interface AgentPermissionDecision {
  canRead: boolean;
  canUse: boolean;
  canManage: boolean;
  canGovern: boolean;
  reason: string;
}

export interface CreateAgentInput {
  code: string;
  name: string;
  roleDescription: string;
  humanOwnerId: string;
  jobTitle: string;
  capabilityVersionIds: string[];
  autonomyLevel: AutonomyLevel;
  includeKnowledgeScope: boolean;
  toolActions: string[];
}

export interface AgentSelectionOption {
  agentId: string;
  agentName: string;
  roleDescription: string;
  humanOwner: {
    userId: string;
    displayName: string;
  };
  autonomyLevel: AutonomyLevel;
  agentVersionRef: AgentVersionRef;
  capabilityVersionRefs: CapabilityVersionRef[];
  acceptedTaskTypes: CapabilityTaskType[];
  knowledgeScopeCount: number;
  toolActions: string[];
}

export function toAgentVersionRef(
  agent: Agent,
  version: AgentVersion,
): AgentVersionRef {
  return {
    kind: "AGENT",
    objectId: agent.id,
    versionId: version.id,
    versionNumber: version.versionNumber,
    digest: version.contentDigest,
  };
}
