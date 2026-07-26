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

export type TaskHistoryActor =
  | {
      actorType: "USER";
      actorId: string;
    }
  | {
      actorType: "AGENT";
      actorId: string;
    };

export interface HumanOwnerRef {
  userId: string;
  displayName: string;
}

export interface AgentAssignment {
  agentId: string;
  agentName: string;
  agentVersionRef: AgentVersionRef;
  autonomyLevel: "L0建议" | "L1辅助" | "L2受控执行";
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
  actor: TaskHistoryActor;
  occurredAt: string;
  aggregateVersion: number;
}

export type ExecutionRunStatus = "RUNNING" | "SUCCEEDED";

export type ExecutionStepStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "WAITING_HUMAN";

export type ExecutionStepResultType =
  | "STEP_SUCCEEDED"
  | "ARTIFACT_DRAFT"
  | "HUMAN_REVIEW";

export interface ExecutionStepRecord {
  stepId: string;
  sequence: number;
  name: string;
  status: ExecutionStepStatus;
  resultType?: ExecutionStepResultType;
  summary?: string;
  outputReference?: string;
  outputDigest?: string;
  completedAt?: string;
}

export interface WorkflowCheckpoint {
  id: string;
  sequence: number;
  stepId: string;
  status: "COMPLETED";
  inputDigest: string;
  outputReference: string;
  outputDigest: string;
  createdAt: string;
  createdByAgentId: string;
}

export interface ExecutionRun {
  id: string;
  taskId: string;
  runNumber: number;
  status: ExecutionRunStatus;
  workflowVersionId: string;
  agentVersionId: string;
  executionPackageDigest: string;
  currentStepId?: string;
  currentCheckpointId?: string;
  idempotencyKey: string;
  workerPool: "agent-reasoning";
  attemptCount: number;
  startedAt: string;
  checkpointedAt?: string;
  finishedAt?: string;
  steps: ExecutionStepRecord[];
  checkpoints: WorkflowCheckpoint[];
}

export interface RuntimeStepResult {
  stepId: string;
  resultType: "STEP_SUCCEEDED" | "ARTIFACT_DRAFT";
  summary: string;
  outputReference: string;
  outputDigest: string;
  artifactVersionRef?: ArtifactVersionRef;
  citationRefs?: CitationRef[];
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
  executionRun?: ExecutionRun;
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
