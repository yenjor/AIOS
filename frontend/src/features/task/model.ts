import type {
  RiskLevel,
  TaskArtifactType,
  TaskStatus,
  TaskTemplateName,
} from "./task-status";

export interface TaskScope {
  organizationId: string;
  workspaceId: string;
}

/**
 * A repository actor is an identity reference only. Display roles never grant
 * permission; the repository resolves the stable user ID against its policy.
 */
export interface TaskActor {
  userId: string;
}

export type VersionRefKind =
  | "AGENT"
  | "CAPABILITY"
  | "KNOWLEDGE"
  | "TOOL"
  | "WORKFLOW"
  | "PLAN"
  | "ARTIFACT";

export interface VersionRef {
  kind: VersionRefKind;
  objectId: string;
  versionId: string;
  versionNumber: number;
  digest: string;
}

export interface AgentVersionRef extends VersionRef {
  kind: "AGENT";
}

export interface CapabilityVersionRef extends VersionRef {
  kind: "CAPABILITY";
}

export interface KnowledgeVersionRef extends VersionRef {
  kind: "KNOWLEDGE";
}

export interface ToolVersionRef extends VersionRef {
  kind: "TOOL";
  actionId: string;
  operationType: "READ";
}

export interface WorkflowVersionRef extends VersionRef {
  kind: "WORKFLOW";
}

export interface PlanVersionRef extends VersionRef {
  kind: "PLAN";
}

export interface ArtifactVersionRef extends VersionRef {
  kind: "ARTIFACT";
  artifactType: TaskArtifactType | "执行摘要";
  accepted: boolean;
}

export interface CitationRef {
  knowledgeVersionRef: KnowledgeVersionRef;
  locator: string;
  digest: string;
}

export interface HumanOwnerRef {
  userId: string;
  displayName: string;
}

export interface AgentAssignment {
  agentId: string;
  agentName: "AI研发员工";
  agentVersionRef: AgentVersionRef;
  autonomyLevel: "L1辅助";
  humanOwner: HumanOwnerRef;
}

export type PlanStepResponsibility =
  | "AI研发员工"
  | "Validation"
  | "Reviewer";

export type PlanStepType =
  | "AGENT"
  | "KNOWLEDGE_RETRIEVAL"
  | "VALIDATION"
  | "HUMAN_REVIEW";

export interface PlanStep {
  id: string;
  sequence: number;
  name: string;
  description: string;
  stepType: PlanStepType;
  responsibility: PlanStepResponsibility;
  riskLevel: RiskLevel;
}

export interface ExecutionPlan {
  versionRef: PlanVersionRef;
  goalInterpretation: string;
  assumptions: string[];
  missingInformation: string[];
  steps: PlanStep[];
  scopeDigest: string;
}

export type ApprovalPointStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

export interface ApprovalPoint {
  id: string;
  name: "计划确认" | "Artifact验收";
  requiredFor: "PLAN_EXECUTION" | "ARTIFACT_ACCEPTANCE";
  riskLevel: RiskLevel;
  status: ApprovalPointStatus;
  reviewerUserIds: string[];
}

export interface ExpectedArtifact {
  artifactType: TaskArtifactType;
  state: "EXPECTED";
  sections: string[];
  knowledgeCitationRequired: boolean;
}

export type TaskWizardStep = 1 | 2 | 3 | 4 | 5;

export interface TaskDraft {
  wizardStep?: TaskWizardStep;
  currentProblem?: string;
  workScope?: string;
  expectedCompletionAt?: string;
  templateName?: TaskTemplateName;
  title?: string;
  goal?: string;
  constraints?: string[];
  outOfScope?: string[];
  priority?: number;
  riskLevel?: RiskLevel;
  capabilityVersionRefs?: CapabilityVersionRef[];
  knowledgeVersionRefs?: KnowledgeVersionRef[];
  toolVersionRefs?: ToolVersionRef[];
  assignedAgent?: AgentAssignment;
  expectedArtifact?: ExpectedArtifact;
  completionCriteria?: string[];
  updatedAt?: string;
}

export type TaskOwner =
  | {
      actorType: "USER";
      actorId: string;
      displayName: string;
    }
  | {
      actorType: "AGENT";
      actorId: string;
      displayName: string;
    };

export interface TaskHistoryItem {
  id: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  reasonCode: string;
  actor: TaskActor;
  occurredAt: string;
  aggregateVersion: number;
}

export interface TaskListItem {
  id: string;
  scope: TaskScope;
  title: string;
  goalSummary: string;
  templateName: TaskTemplateName;
  expectedArtifactType: TaskArtifactType;
  status: TaskStatus;
  priority: number;
  riskLevel: RiskLevel;
  initiator: TaskActor;
  currentOwner?: TaskOwner;
  assignedAgentName?: string;
  participantUserIds: string[];
  approverUserIds: string[];
  reviewerUserIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskDetail extends TaskListItem {
  goal: string;
  constraints: string[];
  outOfScope: string[];
  completionCriteria: string[];
  assignedAgent?: AgentAssignment;
  capabilityVersionRefs: CapabilityVersionRef[];
  knowledgeVersionRefs: KnowledgeVersionRef[];
  toolVersionRefs: ToolVersionRef[];
  workflowVersionRef?: WorkflowVersionRef;
  executionPlan?: ExecutionPlan;
  approvalPoints: ApprovalPoint[];
  expectedArtifact: ExpectedArtifact;
  artifactVersionRefs: ArtifactVersionRef[];
  citationRefs: CitationRef[];
  history: TaskHistoryItem[];
  aggregateVersion: number;
}

export interface PlannedTaskDetail extends TaskDetail {
  assignedAgent: AgentAssignment;
  workflowVersionRef: WorkflowVersionRef;
  executionPlan: ExecutionPlan;
}

export type TaskOwnershipFilter =
  | "all"
  | "mine"
  | "participating"
  | "pendingApproval"
  | "pendingReview";

export interface TaskQuery {
  keyword?: string;
  status?: TaskStatus | TaskStatus[];
  template?: TaskTemplateName | TaskTemplateName[];
  risk?: RiskLevel | RiskLevel[];
  ownership?: TaskOwnershipFilter;
  page?: number;
  pageSize?: number;
}

export interface TaskPage {
  total: number;
  page: number;
  pageSize: number;
  items: TaskListItem[];
}

export interface TaskPermissionDecision {
  allowed: boolean;
  code: "ALLOWED" | "FORBIDDEN";
  reason: string;
}
