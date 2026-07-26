import { organization, users, workspace } from "@/mock/fixtures";

import type {
  AgentAssignment,
  ApprovalPoint,
  CapabilityVersionRef,
  ExecutionPlan,
  ExpectedArtifact,
  KnowledgeVersionRef,
  PlanStep,
  TaskActor,
  TaskDetail,
  TaskDraft,
  TaskHistoryItem,
  TaskListItem,
  TaskOwner,
  TaskPage,
  TaskPermissionDecision,
  TaskQuery,
  TaskScope,
  TaskWizardStep,
  ToolVersionRef,
  VersionRef,
} from "../model";
import {
  RISK_LEVELS,
  TASK_STATUSES,
  TASK_TEMPLATE_ARTIFACTS,
  TASK_TEMPLATE_NAMES,
  type RiskLevel,
  type TaskArtifactType,
  type TaskStatus,
  type TaskTemplateName,
} from "../task-status";
import {
  aiosKnowledgeVersionRef,
  goldenTechnicalSolutionTask,
  readOnlyCodeToolVersionRef,
  taskFixtures,
  technicalSolutionCapabilityVersionRef,
} from "./task-fixtures";

export const TASK_STORE_KEY = "aios.mock.task-store.v1";
const TASK_STORE_SCHEMA_VERSION = 1;
const DEFAULT_LATENCY_MS = 30;

export type TaskRepositoryErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_STORE"
  | "VALIDATION";

export class TaskRepositoryError extends Error {
  constructor(
    public readonly code: TaskRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TaskRepositoryError";
  }
}

export interface TaskStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface TaskRepository {
  getTaskPermission(
    scope: TaskScope,
    actor: TaskActor,
  ): Promise<TaskPermissionDecision>;
  listTasks(
    scope: TaskScope,
    actor: TaskActor,
    query?: TaskQuery,
  ): Promise<TaskPage>;
  getTask(
    scope: TaskScope,
    actor: TaskActor,
    taskId: string,
  ): Promise<TaskDetail>;
  getDraft(
    scope: TaskScope,
    actor: TaskActor,
  ): Promise<TaskDraft | undefined>;
  saveDraft(
    scope: TaskScope,
    actor: TaskActor,
    draft: TaskDraft,
  ): Promise<TaskDraft>;
  discardDraft(scope: TaskScope, actor: TaskActor): Promise<void>;
  submitTechnicalSolutionTask(
    scope: TaskScope,
    actor: TaskActor,
  ): Promise<TaskDetail>;
}

export interface CreateTaskRepositoryOptions {
  storage?: TaskStorage;
  delay?: () => Promise<void>;
  now?: () => string;
}

interface StoredAgentAssignment {
  agentId: string;
  agentVersionRef: VersionRef;
  autonomyLevel: "L1辅助";
  humanOwnerUserId: string;
}

interface StoredTaskDraft {
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
  assignedAgent?: StoredAgentAssignment;
  expectedArtifact?: ExpectedArtifact;
  completionCriteria?: string[];
  updatedAt?: string;
}

interface StoredTaskOwner {
  actorType: "USER" | "AGENT";
  actorId: string;
}

interface StoredTaskRecord {
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
  currentOwner?: StoredTaskOwner;
  participantUserIds: string[];
  approverUserIds: string[];
  reviewerUserIds: string[];
  createdAt: string;
  updatedAt: string;
  goal: string;
  constraints: string[];
  outOfScope: string[];
  completionCriteria: string[];
  assignedAgent: StoredAgentAssignment;
  capabilityVersionRefs: CapabilityVersionRef[];
  knowledgeVersionRefs: KnowledgeVersionRef[];
  toolVersionRefs: ToolVersionRef[];
  workflowVersionRef: VersionRef;
  executionPlan: ExecutionPlan;
  approvalPoints: ApprovalPoint[];
  expectedArtifact: ExpectedArtifact;
  artifactVersionRefs: [];
  citationRefs: [];
  history: TaskHistoryItem[];
  aggregateVersion: number;
}

interface StoredWorkspace {
  organizationId: string;
  workspaceId: string;
  draftsByActor: Record<string, StoredTaskDraft>;
  createdTasks: StoredTaskRecord[];
}

interface TaskStoreEnvelope {
  schemaVersion: 1;
  nextTaskSequence: number;
  workspaces: Record<string, StoredWorkspace>;
}

type UnknownRecord = Record<string, unknown>;

const canonicalScope: TaskScope = {
  organizationId: organization.id,
  workspaceId: workspace.id,
};

const writableActorIds = new Set([
  "user-pm",
  "user-dev",
  "user-lead",
  "user-admin",
]);
const validActorIds = new Set(users.map(({ id }) => id));

function defaultDelay(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, DEFAULT_LATENCY_MS);
  });
}

function getBrowserStorage(): TaskStorage {
  if (typeof window === "undefined") {
    throw new TaskRepositoryError(
      "VALIDATION",
      "Task Mock Repository requires a browser storage boundary.",
    );
  }

  return window.sessionStorage;
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: UnknownRecord,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  const actual = Object.keys(value);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    actual.every((key) => allowed.has(key))
  );
}

function isOneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): value is T[number] {
  return typeof value === "string" && allowed.includes(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isNonEmptyString)
  );
}

function isValidPriority(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 100;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return false;
  }

  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function isTaskScope(value: unknown): value is TaskScope {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["organizationId", "workspaceId"]) &&
    value.organizationId === canonicalScope.organizationId &&
    value.workspaceId === canonicalScope.workspaceId
  );
}

function isKnownTaskActor(value: unknown): value is TaskActor {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["userId"]) &&
    typeof value.userId === "string" &&
    validActorIds.has(value.userId)
  );
}

function isKnownUserId(value: unknown): value is string {
  return typeof value === "string" && validActorIds.has(value);
}

function isKnownUserIdArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(isKnownUserId) &&
    new Set(value).size === value.length
  );
}

function versionRefKeys(kind: string): string[] {
  return kind === "TOOL"
    ? [
        "kind",
        "objectId",
        "versionId",
        "versionNumber",
        "digest",
        "actionId",
        "operationType",
      ]
    : ["kind", "objectId", "versionId", "versionNumber", "digest"];
}

function isVersionRef(value: unknown, expectedKind: string): value is VersionRef {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, versionRefKeys(expectedKind)) ||
    value.kind !== expectedKind ||
    !isNonEmptyString(value.objectId) ||
    !isNonEmptyString(value.versionId) ||
    !isPositiveSafeInteger(value.versionNumber) ||
    !isNonEmptyString(value.digest)
  ) {
    return false;
  }

  if (expectedKind === "TOOL") {
    return (
      isNonEmptyString(value.actionId) &&
      value.operationType === "READ"
    );
  }

  return true;
}

function matchesVersionRef(
  value: unknown,
  expected: VersionRef,
  expectedKind: VersionRef["kind"],
): boolean {
  return (
    isVersionRef(value, expectedKind) &&
    value.objectId === expected.objectId &&
    value.versionId === expected.versionId &&
    value.versionNumber === expected.versionNumber &&
    value.digest === expected.digest
  );
}

function isKnownCapabilityRef(value: unknown): value is CapabilityVersionRef {
  return matchesVersionRef(
    value,
    technicalSolutionCapabilityVersionRef,
    "CAPABILITY",
  );
}

function isKnownKnowledgeRef(value: unknown): value is KnowledgeVersionRef {
  return matchesVersionRef(value, aiosKnowledgeVersionRef, "KNOWLEDGE");
}

function isKnownToolRef(value: unknown): value is ToolVersionRef {
  return (
    matchesVersionRef(value, readOnlyCodeToolVersionRef, "TOOL") &&
    isRecord(value) &&
    value.actionId === readOnlyCodeToolVersionRef.actionId &&
    value.operationType === "READ"
  );
}

function isKnownAgentRef(value: unknown): boolean {
  return (
    isVersionRef(value, "AGENT") &&
    value.objectId === "agent-rd-001" &&
    value.versionId === "agent-rd-001-v1" &&
    value.versionNumber === 1 &&
    value.digest === "sha256:agent-rd-001-v1"
  );
}

function isKnownWorkflowRef(value: unknown): boolean {
  return (
    isVersionRef(value, "WORKFLOW") &&
    value.objectId === "workflow-technical-solution" &&
    value.versionId === "workflow-technical-solution-v1" &&
    value.versionNumber === 1 &&
    value.digest === "sha256:workflow-technical-solution-v1"
  );
}

function isStoredAgentAssignment(
  value: unknown,
): value is StoredAgentAssignment {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "agentId",
      "agentVersionRef",
      "autonomyLevel",
      "humanOwnerUserId",
    ]) &&
    value.agentId === "agent-rd-001" &&
    isKnownAgentRef(value.agentVersionRef) &&
    value.autonomyLevel === "L1辅助" &&
    isKnownUserId(value.humanOwnerUserId) &&
    value.humanOwnerUserId === "user-lead"
  );
}

function isAgentAssignment(value: unknown): value is AgentAssignment {
  const canonicalAssignment = goldenTechnicalSolutionTask.assignedAgent;
  return (
    canonicalAssignment !== undefined &&
    isRecord(value) &&
    hasExactKeys(value, [
      "agentId",
      "agentName",
      "agentVersionRef",
      "autonomyLevel",
      "humanOwner",
    ]) &&
    value.agentId === canonicalAssignment.agentId &&
    value.agentName === canonicalAssignment.agentName &&
    isKnownAgentRef(value.agentVersionRef) &&
    value.autonomyLevel === canonicalAssignment.autonomyLevel &&
    isRecord(value.humanOwner) &&
    hasExactKeys(value.humanOwner, ["userId", "displayName"]) &&
    value.humanOwner.userId === canonicalAssignment.humanOwner.userId &&
    value.humanOwner.displayName === canonicalAssignment.humanOwner.displayName
  );
}

function isExpectedArtifact(value: unknown): value is ExpectedArtifact {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "artifactType",
      "state",
      "sections",
      "knowledgeCitationRequired",
    ]) &&
    Object.values(TASK_TEMPLATE_ARTIFACTS).includes(
      value.artifactType as never,
    ) &&
    value.state === "EXPECTED" &&
    isNonEmptyStringArray(value.sections) &&
    typeof value.knowledgeCitationRequired === "boolean"
  );
}

function isPlanStep(value: unknown): value is PlanStep {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "id",
      "sequence",
      "name",
      "description",
      "stepType",
      "responsibility",
      "riskLevel",
    ]) &&
    isNonEmptyString(value.id) &&
    isPositiveInteger(value.sequence) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.description) &&
    isOneOf(value.stepType, [
      "AGENT",
      "KNOWLEDGE_RETRIEVAL",
      "VALIDATION",
      "HUMAN_REVIEW",
    ] as const) &&
    isOneOf(value.responsibility, [
      "AI研发员工",
      "Validation",
      "Reviewer",
    ] as const) &&
    isOneOf(value.riskLevel, RISK_LEVELS)
  );
}

const technicalSolutionPlanStepContract = [
  {
    name: "需求理解与约束确认",
    description: "明确目标、范围、不做事项和验收标准。",
    stepType: "AGENT",
    responsibility: "AI研发员工",
    riskLevel: "R0",
  },
  {
    name: "代码与模块影响分析",
    description: "只读检索代码结构并识别可能受影响的模块与文件。",
    stepType: "KNOWLEDGE_RETRIEVAL",
    responsibility: "AI研发员工",
    riskLevel: "R0",
  },
  {
    name: "形成技术方案草稿",
    description: "依据固定 Capability 与 Knowledge Version 形成结构化草稿。",
    stepType: "AGENT",
    responsibility: "AI研发员工",
    riskLevel: "R1",
  },
  {
    name: "方案结构和引用检查",
    description: "检查 Artifact 结构、关键结论和 Knowledge Citation。",
    stepType: "VALIDATION",
    responsibility: "Validation",
    riskLevel: "R1",
  },
  {
    name: "Artifact人工验收",
    description: "由授权 Reviewer 验收技术方案 Artifact。",
    stepType: "HUMAN_REVIEW",
    responsibility: "Reviewer",
    riskLevel: "R1",
  },
] as const satisfies ReadonlyArray<
  Pick<
    PlanStep,
    "name" | "description" | "stepType" | "responsibility" | "riskLevel"
  >
>;

const technicalSolutionGoalInterpretation =
  "在现有 AIOS 架构边界内形成可评审、可实施的技术方案。";
const technicalSolutionAssumptions = [
  "现有文档为 Single Source of Truth",
] as const;

function isExecutionPlan(value: unknown, taskId: string): value is ExecutionPlan {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "versionRef",
      "goalInterpretation",
      "assumptions",
      "missingInformation",
      "steps",
      "scopeDigest",
    ]) ||
    !isVersionRef(value.versionRef, "PLAN") ||
    !isNonEmptyString(value.goalInterpretation) ||
    !isStringArray(value.assumptions) ||
    !isStringArray(value.missingInformation) ||
    !Array.isArray(value.steps) ||
    value.steps.length !== 5 ||
    !value.steps.every(isPlanStep) ||
    !isNonEmptyString(value.scopeDigest)
  ) {
    return false;
  }

  const objectId = `plan-${taskId}`;
  return (
    value.versionRef.objectId === objectId &&
    value.versionRef.versionId === `${objectId}-v1` &&
    value.versionRef.versionNumber === 1 &&
    value.versionRef.digest === `sha256:${objectId}-v1` &&
    value.goalInterpretation === technicalSolutionGoalInterpretation &&
    value.assumptions.length === technicalSolutionAssumptions.length &&
    value.assumptions.every(
      (assumption, index) =>
        assumption === technicalSolutionAssumptions[index],
    ) &&
    value.missingInformation.length === 0 &&
    value.scopeDigest === `sha256:scope-${taskId}` &&
    value.steps.every((step, index) => {
      const expected = technicalSolutionPlanStepContract[index];
      return (
        step.id ===
          `${taskId}-step-${String(index + 1).padStart(2, "0")}` &&
        step.sequence === index + 1 &&
        step.name === expected.name &&
        step.description === expected.description &&
        step.stepType === expected.stepType &&
        step.responsibility === expected.responsibility &&
        step.riskLevel === expected.riskLevel
      );
    })
  );
}

function isApprovalPoint(value: unknown, taskId: string): value is ApprovalPoint {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "id",
      "name",
      "requiredFor",
      "riskLevel",
      "status",
      "reviewerUserIds",
    ]) &&
    typeof value.id === "string" &&
    value.id.startsWith(`${taskId}-approval-`) &&
    isOneOf(value.name, ["计划确认", "Artifact验收"] as const) &&
    isOneOf(value.requiredFor, [
      "PLAN_EXECUTION",
      "ARTIFACT_ACCEPTANCE",
    ] as const) &&
    isOneOf(value.riskLevel, RISK_LEVELS) &&
    isOneOf(value.status, [
      "PENDING",
      "APPROVED",
      "REJECTED",
      "EXPIRED",
    ] as const) &&
    isKnownUserIdArray(value.reviewerUserIds)
  );
}

const approvalPointContract = [
  {
    idSuffix: "approval-plan",
    name: "计划确认",
    requiredFor: "PLAN_EXECUTION",
  },
  {
    idSuffix: "approval-artifact",
    name: "Artifact验收",
    requiredFor: "ARTIFACT_ACCEPTANCE",
  },
] as const;

function isCanonicalApprovalPoints(
  value: unknown,
  taskId: string,
): value is ApprovalPoint[] {
  return (
    Array.isArray(value) &&
    value.length === approvalPointContract.length &&
    value.every((point, index) => {
      if (!isApprovalPoint(point, taskId)) {
        return false;
      }
      const expected = approvalPointContract[index];
      return (
        point.id === `${taskId}-${expected.idSuffix}` &&
        point.name === expected.name &&
        point.requiredFor === expected.requiredFor &&
        point.riskLevel === "R1" &&
        point.status === "PENDING" &&
        point.reviewerUserIds.length === 1 &&
        point.reviewerUserIds[0] === "user-lead"
      );
    }) &&
    new Set(value.map((point) => point.id)).size === value.length
  );
}

function isTaskHistoryItem(value: unknown, taskId: string): value is TaskHistoryItem {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "id",
      "fromStatus",
      "toStatus",
      "reasonCode",
      "actor",
      "occurredAt",
      "aggregateVersion",
    ]) &&
    typeof value.id === "string" &&
    value.id.startsWith(`${taskId}-transition-`) &&
    (value.fromStatus === null || isOneOf(value.fromStatus, TASK_STATUSES)) &&
    isOneOf(value.toStatus, TASK_STATUSES) &&
    isNonEmptyString(value.reasonCode) &&
    isKnownTaskActor(value.actor) &&
    isIsoTimestamp(value.occurredAt) &&
    isPositiveSafeInteger(value.aggregateVersion)
  );
}

const submittedHistoryContract = [
  {
    fromStatus: null,
    toStatus: "DRAFT",
    reasonCode: "TASK_CREATED",
  },
  {
    fromStatus: "DRAFT",
    toStatus: "READY",
    reasonCode: "TASK_READY",
  },
  {
    fromStatus: "READY",
    toStatus: "PLANNING",
    reasonCode: "TASK_PLANNING",
  },
  {
    fromStatus: "PLANNING",
    toStatus: "NEED_APPROVAL",
    reasonCode: "TASK_NEED_APPROVAL",
  },
] as const satisfies ReadonlyArray<{
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  reasonCode: string;
}>;

function isCanonicalSubmittedHistory(
  value: unknown,
  taskId: string,
  initiatorUserId: string,
  createdAt: string,
  updatedAt: string,
): value is TaskHistoryItem[] {
  return (
    Array.isArray(value) &&
    value.length === submittedHistoryContract.length &&
    value.every((item, index) => {
      if (!isTaskHistoryItem(item, taskId)) {
        return false;
      }
      const expected = submittedHistoryContract[index];
      return (
        item.id ===
          `${taskId}-transition-${String(index + 1).padStart(2, "0")}` &&
        item.fromStatus === expected.fromStatus &&
        item.toStatus === expected.toStatus &&
        item.reasonCode === expected.reasonCode &&
        item.actor.userId === initiatorUserId &&
        item.aggregateVersion === index + 1 &&
        item.occurredAt >= createdAt &&
        item.occurredAt <= updatedAt &&
        (index === 0 ||
          item.occurredAt >=
            (value[index - 1] as TaskHistoryItem).occurredAt)
      );
    })
  );
}

const draftKeys = [
  "wizardStep",
  "currentProblem",
  "workScope",
  "expectedCompletionAt",
  "templateName",
  "title",
  "goal",
  "constraints",
  "outOfScope",
  "priority",
  "riskLevel",
  "capabilityVersionRefs",
  "knowledgeVersionRefs",
  "toolVersionRefs",
  "assignedAgent",
  "expectedArtifact",
  "completionCriteria",
  "updatedAt",
] as const;

const taskWizardSteps = [1, 2, 3, 4, 5] as const satisfies readonly TaskWizardStep[];

function isTaskWizardStep(value: unknown): value is TaskWizardStep {
  return taskWizardSteps.includes(value as TaskWizardStep);
}

function isStoredTaskDraft(value: unknown): value is StoredTaskDraft {
  if (!isRecord(value) || !hasExactKeys(value, [], draftKeys)) {
    return false;
  }

  return (
    (value.wizardStep === undefined ||
      isTaskWizardStep(value.wizardStep)) &&
    (value.currentProblem === undefined ||
      isNonEmptyString(value.currentProblem)) &&
    (value.workScope === undefined || isNonEmptyString(value.workScope)) &&
    (value.expectedCompletionAt === undefined ||
      isIsoTimestamp(value.expectedCompletionAt)) &&
    (value.templateName === undefined ||
      isOneOf(value.templateName, TASK_TEMPLATE_NAMES)) &&
    (value.title === undefined || isNonEmptyString(value.title)) &&
    (value.goal === undefined || isNonEmptyString(value.goal)) &&
    (value.constraints === undefined || isStringArray(value.constraints)) &&
    (value.outOfScope === undefined || isStringArray(value.outOfScope)) &&
    (value.priority === undefined || isValidPriority(value.priority)) &&
    (value.riskLevel === undefined ||
      isOneOf(value.riskLevel, RISK_LEVELS)) &&
    (value.capabilityVersionRefs === undefined ||
      (Array.isArray(value.capabilityVersionRefs) &&
        value.capabilityVersionRefs.every(isKnownCapabilityRef))) &&
    (value.knowledgeVersionRefs === undefined ||
      (Array.isArray(value.knowledgeVersionRefs) &&
        value.knowledgeVersionRefs.every(isKnownKnowledgeRef))) &&
    (value.toolVersionRefs === undefined ||
      (Array.isArray(value.toolVersionRefs) &&
        value.toolVersionRefs.every(isKnownToolRef))) &&
    (value.assignedAgent === undefined ||
      isStoredAgentAssignment(value.assignedAgent)) &&
    (value.expectedArtifact === undefined ||
      isExpectedArtifact(value.expectedArtifact)) &&
    (value.completionCriteria === undefined ||
      isStringArray(value.completionCriteria)) &&
    (value.updatedAt === undefined || isIsoTimestamp(value.updatedAt))
  );
}

function isStoredTaskOwner(value: unknown): value is StoredTaskOwner {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["actorType", "actorId"]) ||
    !isOneOf(value.actorType, ["USER", "AGENT"] as const) ||
    !isNonEmptyString(value.actorId)
  ) {
    return false;
  }

  return value.actorType === "USER"
    ? validActorIds.has(value.actorId)
    : value.actorId === "agent-rd-001";
}

const storedTaskRequiredKeys = [
  "id",
  "scope",
  "title",
  "goalSummary",
  "templateName",
  "expectedArtifactType",
  "status",
  "priority",
  "riskLevel",
  "initiator",
  "participantUserIds",
  "approverUserIds",
  "reviewerUserIds",
  "createdAt",
  "updatedAt",
  "goal",
  "constraints",
  "outOfScope",
  "completionCriteria",
  "assignedAgent",
  "capabilityVersionRefs",
  "knowledgeVersionRefs",
  "toolVersionRefs",
  "workflowVersionRef",
  "executionPlan",
  "approvalPoints",
  "expectedArtifact",
  "artifactVersionRefs",
  "citationRefs",
  "history",
  "aggregateVersion",
] as const;

function isStoredTaskRecord(value: unknown): value is StoredTaskRecord {
  const taskId =
    isRecord(value) && typeof value.id === "string" ? value.id : "";
  const createdAt =
    isRecord(value) && typeof value.createdAt === "string"
      ? value.createdAt
      : "";
  const updatedAt =
    isRecord(value) && typeof value.updatedAt === "string"
      ? value.updatedAt
      : "";
  if (
    !isRecord(value) ||
    !hasExactKeys(value, storedTaskRequiredKeys, ["currentOwner"]) ||
    !isNonEmptyString(value.id) ||
    taskSequenceFromId(value.id) === undefined ||
    !isTaskScope(value.scope) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.goalSummary) ||
    value.templateName !== "生成技术方案" ||
    value.expectedArtifactType !== "技术方案" ||
    value.status !== "NEED_APPROVAL" ||
    !isValidPriority(value.priority) ||
    !isOneOf(value.riskLevel, RISK_LEVELS) ||
    !isKnownTaskActor(value.initiator) ||
    !writableActorIds.has(value.initiator.userId) ||
    (value.currentOwner !== undefined && !isStoredTaskOwner(value.currentOwner)) ||
    !isKnownUserIdArray(value.participantUserIds) ||
    !isKnownUserIdArray(value.approverUserIds) ||
    !isKnownUserIdArray(value.reviewerUserIds) ||
    !isIsoTimestamp(value.createdAt) ||
    !isIsoTimestamp(value.updatedAt) ||
    updatedAt < createdAt ||
    !isNonEmptyString(value.goal) ||
    !isNonEmptyStringArray(value.constraints) ||
    !isNonEmptyStringArray(value.outOfScope) ||
    !isNonEmptyStringArray(value.completionCriteria) ||
    !isStoredAgentAssignment(value.assignedAgent) ||
    !Array.isArray(value.capabilityVersionRefs) ||
    value.capabilityVersionRefs.length !== 1 ||
    !value.capabilityVersionRefs.every(isKnownCapabilityRef) ||
    !Array.isArray(value.knowledgeVersionRefs) ||
    value.knowledgeVersionRefs.length !== 1 ||
    !value.knowledgeVersionRefs.every(isKnownKnowledgeRef) ||
    !Array.isArray(value.toolVersionRefs) ||
    value.toolVersionRefs.length !== 1 ||
    !value.toolVersionRefs.every(isKnownToolRef) ||
    !isKnownWorkflowRef(value.workflowVersionRef) ||
    !isExecutionPlan(value.executionPlan, taskId) ||
    !isCanonicalApprovalPoints(value.approvalPoints, taskId) ||
    !isExpectedArtifact(value.expectedArtifact) ||
    value.expectedArtifact.artifactType !== "技术方案" ||
    !Array.isArray(value.artifactVersionRefs) ||
    value.artifactVersionRefs.length !== 0 ||
    !Array.isArray(value.citationRefs) ||
    value.citationRefs.length !== 0 ||
    !isCanonicalSubmittedHistory(
      value.history,
      taskId,
      value.initiator.userId,
      createdAt,
      updatedAt,
    ) ||
    value.aggregateVersion !== 4
  ) {
    return false;
  }

  return (
    value.expectedArtifact.sections.join("|") ===
      goldenTechnicalSolutionTask.expectedArtifact.sections.join("|") &&
    value.expectedArtifact.knowledgeCitationRequired
  );
}

function isStoredWorkspace(value: unknown): value is StoredWorkspace {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "organizationId",
      "workspaceId",
      "draftsByActor",
      "createdTasks",
    ]) ||
    value.organizationId !== canonicalScope.organizationId ||
    value.workspaceId !== canonicalScope.workspaceId ||
    !isRecord(value.draftsByActor) ||
    !Array.isArray(value.createdTasks)
  ) {
    return false;
  }

  if (
    !Object.entries(value.draftsByActor).every(
      ([actorId, draft]) =>
        writableActorIds.has(actorId) && isStoredTaskDraft(draft),
    ) ||
    !value.createdTasks.every(isStoredTaskRecord)
  ) {
    return false;
  }

  const storedTasks = value.createdTasks as StoredTaskRecord[];
  const taskIds = storedTasks.map((task) => task.id);
  const taskSequences = taskIds.map(taskSequenceFromId);
  return (
    new Set(taskIds).size === taskIds.length &&
    taskSequences.every((sequence) => sequence !== undefined) &&
    new Set(taskSequences).size === taskSequences.length
  );
}

function isTaskStoreEnvelope(value: unknown): value is TaskStoreEnvelope {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "schemaVersion",
      "nextTaskSequence",
      "workspaces",
    ]) ||
    value.schemaVersion !== TASK_STORE_SCHEMA_VERSION ||
    !isPositiveSafeInteger(value.nextTaskSequence) ||
    !isRecord(value.workspaces)
  ) {
    return false;
  }

  const entries = Object.entries(value.workspaces);
  if (
    !entries.every(
      ([key, storedWorkspace]) =>
        key === scopeKey(canonicalScope) && isStoredWorkspace(storedWorkspace),
    )
  ) {
    return false;
  }

  const storedTaskSequences = entries.flatMap(([, storedWorkspace]) =>
    (storedWorkspace as StoredWorkspace).createdTasks.map(
      (task) => taskSequenceFromId(task.id)!,
    ),
  );
  return (
    storedTaskSequences.every(Number.isInteger) &&
    storedTaskSequences.every(
      (sequence) => sequence < Number(value.nextTaskSequence),
    )
  );
}

function taskSequenceFromId(taskId: string): number | undefined {
  const match = /^task-mock-(\d{4,})$/.exec(taskId);
  if (!match) {
    return undefined;
  }
  const sequence = Number(match[1]);
  return Number.isSafeInteger(sequence) &&
    sequence > 0 &&
    taskId === taskIdFromSequence(sequence)
    ? sequence
    : undefined;
}

function taskIdFromSequence(sequence: number): string {
  return `task-mock-${String(sequence).padStart(4, "0")}`;
}

function scopeKey(scope: TaskScope): string {
  return `${scope.organizationId}/${scope.workspaceId}`;
}

function emptyEnvelope(): TaskStoreEnvelope {
  return {
    schemaVersion: TASK_STORE_SCHEMA_VERSION,
    nextTaskSequence: 1,
    workspaces: {},
  };
}

function emptyStoredWorkspace(): StoredWorkspace {
  return {
    organizationId: canonicalScope.organizationId,
    workspaceId: canonicalScope.workspaceId,
    draftsByActor: {},
    createdTasks: [],
  };
}

function cloneMutable<T>(value: T): T {
  return structuredClone(value);
}

function userDisplayName(userId: string): string {
  const user = users.find(({ id }) => id === userId);
  if (!user) {
    throw new TaskRepositoryError("INVALID_STORE", "Stored Task identity is invalid.");
  }
  return user.name;
}

function materializeAgentAssignment(
  assignment: StoredAgentAssignment,
): AgentAssignment {
  return {
    agentId: assignment.agentId,
    agentName: "AI研发员工",
    agentVersionRef: cloneMutable(assignment.agentVersionRef) as AgentAssignment["agentVersionRef"],
    autonomyLevel: assignment.autonomyLevel,
    humanOwner: {
      userId: assignment.humanOwnerUserId,
      displayName: userDisplayName(assignment.humanOwnerUserId),
    },
  };
}

function storeAgentAssignment(
  assignment: AgentAssignment,
): StoredAgentAssignment {
  return {
    agentId: assignment.agentId,
    agentVersionRef: cloneMutable(assignment.agentVersionRef),
    autonomyLevel: assignment.autonomyLevel,
    humanOwnerUserId: assignment.humanOwner.userId,
  };
}

function materializeTaskOwner(owner: StoredTaskOwner): TaskOwner {
  return owner.actorType === "AGENT"
    ? {
        actorType: "AGENT",
        actorId: owner.actorId,
        displayName: "AI研发员工",
      }
    : {
        actorType: "USER",
        actorId: owner.actorId,
        displayName: userDisplayName(owner.actorId),
      };
}

function storeTaskOwner(owner: TaskOwner): StoredTaskOwner {
  return {
    actorType: owner.actorType,
    actorId: owner.actorId,
  };
}

function materializeDraft(draft: StoredTaskDraft): TaskDraft {
  return {
    ...cloneMutable(draft),
    assignedAgent: draft.assignedAgent
      ? materializeAgentAssignment(draft.assignedAgent)
      : undefined,
  };
}

function storeDraft(draft: TaskDraft): StoredTaskDraft {
  const stored: StoredTaskDraft = {
    ...cloneMutable(draft),
    assignedAgent: draft.assignedAgent
      ? storeAgentAssignment(draft.assignedAgent)
      : undefined,
  };
  return removeUndefinedValues(stored);
}

function materializeTask(task: StoredTaskRecord): TaskDetail {
  return {
    ...cloneMutable(task),
    currentOwner: task.currentOwner
      ? materializeTaskOwner(task.currentOwner)
      : undefined,
    assignedAgentName: "AI研发员工",
    assignedAgent: materializeAgentAssignment(task.assignedAgent),
    workflowVersionRef: cloneMutable(task.workflowVersionRef) as TaskDetail["workflowVersionRef"],
  };
}

function storeTask(task: TaskDetail): StoredTaskRecord {
  if (
    !task.assignedAgent ||
    !task.workflowVersionRef ||
    !task.executionPlan
  ) {
    throw new TaskRepositoryError(
      "VALIDATION",
      "A submitted Task requires fixed execution references.",
    );
  }

  return removeUndefinedValues({
    id: task.id,
    scope: cloneMutable(task.scope),
    title: task.title,
    goalSummary: task.goalSummary,
    templateName: task.templateName,
    expectedArtifactType: task.expectedArtifactType,
    status: task.status,
    priority: task.priority,
    riskLevel: task.riskLevel,
    initiator: cloneMutable(task.initiator),
    currentOwner: task.currentOwner
      ? storeTaskOwner(task.currentOwner)
      : undefined,
    participantUserIds: cloneMutable(task.participantUserIds),
    approverUserIds: cloneMutable(task.approverUserIds),
    reviewerUserIds: cloneMutable(task.reviewerUserIds),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    goal: task.goal,
    constraints: cloneMutable(task.constraints),
    outOfScope: cloneMutable(task.outOfScope),
    completionCriteria: cloneMutable(task.completionCriteria),
    assignedAgent: storeAgentAssignment(task.assignedAgent),
    capabilityVersionRefs: cloneMutable(task.capabilityVersionRefs),
    knowledgeVersionRefs: cloneMutable(task.knowledgeVersionRefs),
    toolVersionRefs: cloneMutable(task.toolVersionRefs),
    workflowVersionRef: cloneMutable(task.workflowVersionRef),
    executionPlan: cloneMutable(task.executionPlan),
    approvalPoints: cloneMutable(task.approvalPoints),
    expectedArtifact: cloneMutable(task.expectedArtifact),
    artifactVersionRefs: [],
    citationRefs: [],
    history: cloneMutable(task.history),
    aggregateVersion: task.aggregateVersion,
  }) as StoredTaskRecord;
}

function removeUndefinedValues<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, nestedValue]) => nestedValue !== undefined),
  ) as T;
}

function toListItem(task: TaskDetail): TaskListItem {
  return {
    id: task.id,
    scope: cloneMutable(task.scope),
    title: task.title,
    goalSummary: task.goalSummary,
    templateName: task.templateName,
    expectedArtifactType: task.expectedArtifactType,
    status: task.status,
    priority: task.priority,
    riskLevel: task.riskLevel,
    initiator: cloneMutable(task.initiator),
    currentOwner: task.currentOwner
      ? cloneMutable(task.currentOwner)
      : undefined,
    assignedAgentName: task.assignedAgentName,
    participantUserIds: cloneMutable(task.participantUserIds),
    approverUserIds: cloneMutable(task.approverUserIds),
    reviewerUserIds: cloneMutable(task.reviewerUserIds),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function validateScope(scope: unknown): asserts scope is TaskScope {
  if (
    !isRecord(scope) ||
    !hasExactKeys(scope, ["organizationId", "workspaceId"]) ||
    !isNonEmptyString(scope.organizationId) ||
    !isNonEmptyString(scope.workspaceId)
  ) {
    throw new TaskRepositoryError(
      "VALIDATION",
      "Task scope is invalid.",
    );
  }

  if (
    scope.organizationId !== canonicalScope.organizationId ||
    scope.workspaceId !== canonicalScope.workspaceId ||
    workspace.organizationId !== organization.id
  ) {
    throw new TaskRepositoryError("NOT_FOUND", "Task scope was not found.");
  }
}

function validateActor(actor: unknown): asserts actor is TaskActor {
  if (
    !isRecord(actor) ||
    !hasExactKeys(actor, ["userId"]) ||
    !isNonEmptyString(actor.userId)
  ) {
    throw new TaskRepositoryError(
      "VALIDATION",
      "Task actor is invalid.",
    );
  }

  if (!validActorIds.has(actor.userId)) {
    throw new TaskRepositoryError(
      "FORBIDDEN",
      "The current actor cannot access this Task scope.",
    );
  }
}

function createPermissionDecision(actor: TaskActor): TaskPermissionDecision {
  const allowed = writableActorIds.has(actor.userId);
  return {
    allowed,
    code: allowed ? "ALLOWED" : "FORBIDDEN",
    reason: allowed
      ? "Workspace member may create Mock Tasks."
      : "Auditor has read-only Task access.",
  };
}

function requireWritePermission(actor: TaskActor): void {
  const decision = createPermissionDecision(actor);
  if (!decision.allowed) {
    throw new TaskRepositoryError("FORBIDDEN", decision.reason);
  }
}

function isTaskDraftInput(value: unknown): value is TaskDraft {
  if (!isRecord(value) || !hasExactKeys(value, [], draftKeys)) {
    return false;
  }

  return (
    (value.wizardStep === undefined ||
      isTaskWizardStep(value.wizardStep)) &&
    (value.currentProblem === undefined ||
      isNonEmptyString(value.currentProblem)) &&
    (value.workScope === undefined || isNonEmptyString(value.workScope)) &&
    (value.expectedCompletionAt === undefined ||
      isIsoTimestamp(value.expectedCompletionAt)) &&
    (value.templateName === undefined ||
      isOneOf(value.templateName, TASK_TEMPLATE_NAMES)) &&
    (value.title === undefined || isNonEmptyString(value.title)) &&
    (value.goal === undefined || isNonEmptyString(value.goal)) &&
    (value.constraints === undefined || isStringArray(value.constraints)) &&
    (value.outOfScope === undefined || isStringArray(value.outOfScope)) &&
    (value.priority === undefined || isValidPriority(value.priority)) &&
    (value.riskLevel === undefined ||
      isOneOf(value.riskLevel, RISK_LEVELS)) &&
    (value.capabilityVersionRefs === undefined ||
      (Array.isArray(value.capabilityVersionRefs) &&
        value.capabilityVersionRefs.every(isKnownCapabilityRef))) &&
    (value.knowledgeVersionRefs === undefined ||
      (Array.isArray(value.knowledgeVersionRefs) &&
        value.knowledgeVersionRefs.every(isKnownKnowledgeRef))) &&
    (value.toolVersionRefs === undefined ||
      (Array.isArray(value.toolVersionRefs) &&
        value.toolVersionRefs.every(isKnownToolRef))) &&
    (value.assignedAgent === undefined ||
      isAgentAssignment(value.assignedAgent)) &&
    (value.expectedArtifact === undefined ||
      isExpectedArtifact(value.expectedArtifact)) &&
    (value.completionCriteria === undefined ||
      isStringArray(value.completionCriteria)) &&
    (value.updatedAt === undefined || isIsoTimestamp(value.updatedAt))
  );
}

function validateDraftInput(draft: unknown): asserts draft is TaskDraft {
  if (!isRecord(draft) || !hasExactKeys(draft, [], draftKeys)) {
    throw new TaskRepositoryError(
      "VALIDATION",
      "Task draft contains unsupported fields.",
    );
  }

  if (!isTaskDraftInput(draft)) {
    throw new TaskRepositoryError(
      "VALIDATION",
      "Task draft fields are invalid.",
    );
  }

  const validDraft = draft as TaskDraft;
  if (
    validDraft.expectedArtifact &&
    validDraft.templateName &&
    TASK_TEMPLATE_ARTIFACTS[validDraft.templateName] !==
      validDraft.expectedArtifact.artifactType
  ) {
    throw new TaskRepositoryError(
      "VALIDATION",
      "Expected Artifact does not match the Task template.",
    );
  }
}

function requireCompleteTechnicalSolutionDraft(
  draft: TaskDraft | undefined,
): asserts draft is Required<
  Pick<
    TaskDraft,
    | "wizardStep"
    | "currentProblem"
    | "workScope"
    | "expectedCompletionAt"
    | "templateName"
    | "title"
    | "goal"
    | "constraints"
    | "outOfScope"
    | "priority"
    | "riskLevel"
    | "capabilityVersionRefs"
    | "knowledgeVersionRefs"
    | "toolVersionRefs"
    | "assignedAgent"
    | "expectedArtifact"
    | "completionCriteria"
  >
> &
  TaskDraft {
  if (
    !draft ||
    draft.wizardStep !== 5 ||
    !isNonEmptyString(draft.currentProblem) ||
    !isNonEmptyString(draft.workScope) ||
    !isIsoTimestamp(draft.expectedCompletionAt) ||
    draft.templateName !== "生成技术方案" ||
    !isNonEmptyString(draft.title) ||
    !isNonEmptyString(draft.goal) ||
    !isNonEmptyStringArray(draft.constraints) ||
    !isNonEmptyStringArray(draft.outOfScope) ||
    !isValidPriority(draft.priority) ||
    !isOneOf(draft.riskLevel, RISK_LEVELS) ||
    draft.capabilityVersionRefs?.length !== 1 ||
    !draft.capabilityVersionRefs.every(isKnownCapabilityRef) ||
    draft.knowledgeVersionRefs?.length !== 1 ||
    !draft.knowledgeVersionRefs.every(isKnownKnowledgeRef) ||
    draft.toolVersionRefs?.length !== 1 ||
    !draft.toolVersionRefs.every(isKnownToolRef) ||
    !draft.assignedAgent ||
    !isStoredAgentAssignment(storeAgentAssignment(draft.assignedAgent)) ||
    !draft.expectedArtifact ||
    draft.expectedArtifact.artifactType !== "技术方案" ||
    draft.expectedArtifact.state !== "EXPECTED" ||
    !draft.expectedArtifact.knowledgeCitationRequired ||
    draft.expectedArtifact.sections.join("|") !==
      goldenTechnicalSolutionTask.expectedArtifact.sections.join("|") ||
    !isNonEmptyStringArray(draft.completionCriteria)
  ) {
    throw new TaskRepositoryError(
      "VALIDATION",
      "The five Task creation steps must be complete before submission.",
    );
  }
}

function validateQuery(query: TaskQuery): {
  page: number;
  pageSize: number;
} {
  if (
    !isRecord(query) ||
    !hasExactKeys(query, [], [
      "keyword",
      "status",
      "template",
      "risk",
      "ownership",
      "page",
      "pageSize",
    ])
  ) {
    throw new TaskRepositoryError("VALIDATION", "Task query is invalid.");
  }

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  if (
    !isPositiveSafeInteger(page) ||
    !isPositiveSafeInteger(pageSize) ||
    pageSize > 100 ||
    (query.keyword !== undefined && typeof query.keyword !== "string") ||
    !isFilterValue(query.status, TASK_STATUSES) ||
    !isFilterValue(query.template, TASK_TEMPLATE_NAMES) ||
    !isFilterValue(query.risk, RISK_LEVELS) ||
    (query.ownership !== undefined &&
      !isOneOf(query.ownership, [
        "all",
        "mine",
        "participating",
        "pendingApproval",
        "pendingReview",
      ] as const))
  ) {
    throw new TaskRepositoryError("VALIDATION", "Task query is invalid.");
  }

  return { page, pageSize };
}

function isFilterValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): boolean {
  return (
    value === undefined ||
    isOneOf(value, allowed) ||
    (Array.isArray(value) && value.length > 0 && value.every((item) => isOneOf(item, allowed)))
  );
}

function filterValues<T extends string>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function matchesOwnership(
  task: TaskDetail,
  actor: TaskActor,
  ownership: TaskQuery["ownership"],
): boolean {
  switch (ownership ?? "all") {
    case "all":
      return true;
    case "mine":
      return (
        task.initiator.userId === actor.userId ||
        (task.currentOwner?.actorType === "USER" &&
          task.currentOwner.actorId === actor.userId)
      );
    case "participating":
      return task.participantUserIds.includes(actor.userId);
    case "pendingApproval":
      return (
        task.status === "NEED_APPROVAL" &&
        task.approverUserIds.includes(actor.userId)
      );
    case "pendingReview":
      return (
        task.status === "REVIEW" &&
        task.reviewerUserIds.includes(actor.userId)
      );
  }
}

function createTechnicalSolutionTask(
  taskId: string,
  actor: TaskActor,
  draft: Parameters<typeof requireCompleteTechnicalSolutionDraft>[0] &
    TaskDraft,
  now: string,
): TaskDetail {
  requireCompleteTechnicalSolutionDraft(draft);
  const template = cloneMutable(goldenTechnicalSolutionTask) as TaskDetail;
  const planObjectId = `plan-${taskId}`;
  const historyStatuses: TaskStatus[] = [
    "DRAFT",
    "READY",
    "PLANNING",
    "NEED_APPROVAL",
  ];
  const history = historyStatuses.map<TaskHistoryItem>(
    (toStatus, index, statuses) => ({
      id: `${taskId}-transition-${String(index + 1).padStart(2, "0")}`,
      fromStatus: index === 0 ? null : statuses[index - 1],
      toStatus,
      reasonCode: index === 0 ? "TASK_CREATED" : `TASK_${toStatus}`,
      actor: cloneMutable(actor),
      occurredAt: now,
      aggregateVersion: index + 1,
    }),
  );
  const executionPlan = cloneMutable(template.executionPlan!);
  executionPlan.versionRef = {
    kind: "PLAN",
    objectId: planObjectId,
    versionId: `${planObjectId}-v1`,
    versionNumber: 1,
    digest: `sha256:${planObjectId}-v1`,
  };
  executionPlan.scopeDigest = `sha256:scope-${taskId}`;
  executionPlan.steps = executionPlan.steps.map((step, index) => ({
    ...step,
    id: `${taskId}-step-${String(index + 1).padStart(2, "0")}`,
  }));

  return {
    ...template,
    id: taskId,
    scope: cloneMutable(canonicalScope),
    title: draft.title,
    goalSummary: draft.currentProblem,
    templateName: "生成技术方案",
    expectedArtifactType: "技术方案",
    status: "NEED_APPROVAL",
    priority: draft.priority,
    riskLevel: draft.riskLevel,
    initiator: cloneMutable(actor),
    currentOwner: undefined,
    assignedAgentName: "AI研发员工",
    participantUserIds: Array.from(
      new Set([actor.userId, draft.assignedAgent.humanOwner.userId]),
    ),
    approverUserIds: [draft.assignedAgent.humanOwner.userId],
    reviewerUserIds: [draft.assignedAgent.humanOwner.userId],
    createdAt: now,
    updatedAt: now,
    goal: draft.goal,
    constraints: [
      ...cloneMutable(draft.constraints),
      `工作范围：${draft.workScope}`,
      `期望完成时间：${draft.expectedCompletionAt}`,
    ],
    outOfScope: cloneMutable(draft.outOfScope),
    completionCriteria: cloneMutable(draft.completionCriteria),
    assignedAgent: cloneMutable(draft.assignedAgent),
    capabilityVersionRefs: cloneMutable(draft.capabilityVersionRefs),
    knowledgeVersionRefs: cloneMutable(draft.knowledgeVersionRefs),
    toolVersionRefs: cloneMutable(draft.toolVersionRefs),
    workflowVersionRef: cloneMutable(template.workflowVersionRef),
    executionPlan,
    approvalPoints: template.approvalPoints.map((point) => ({
      ...point,
      id: point.name === "计划确认"
        ? `${taskId}-approval-plan`
        : `${taskId}-approval-artifact`,
    })),
    expectedArtifact: cloneMutable(draft.expectedArtifact),
    artifactVersionRefs: [],
    citationRefs: [],
    history,
    aggregateVersion: 4,
  };
}

export function createTaskRepository(
  options: CreateTaskRepositoryOptions = {},
): TaskRepository {
  const storage = options.storage ?? getBrowserStorage();
  const delay = options.delay ?? defaultDelay;
  const now = options.now ?? (() => new Date().toISOString());

  function currentTimestamp(): string {
    const timestamp = now();
    if (!isIsoTimestamp(timestamp)) {
      throw new TaskRepositoryError(
        "VALIDATION",
        "Task clock must return an ISO 8601 UTC timestamp.",
      );
    }
    return timestamp;
  }

  async function prepare(scope: TaskScope, actor: TaskActor): Promise<void> {
    await delay();
    validateScope(scope);
    validateActor(actor);
  }

  function readEnvelope(): TaskStoreEnvelope {
    let rawValue: string | null;
    try {
      rawValue = storage.getItem(TASK_STORE_KEY);
    } catch {
      throw new TaskRepositoryError(
        "INVALID_STORE",
        "Task store is unavailable.",
      );
    }

    if (rawValue === null) {
      return emptyEnvelope();
    }

    try {
      const parsed: unknown = JSON.parse(rawValue);
      if (!isTaskStoreEnvelope(parsed)) {
        throw new Error("invalid");
      }
      return parsed;
    } catch {
      try {
        storage.removeItem(TASK_STORE_KEY);
      } catch {
        // The fail-closed error remains authoritative if cleanup is unavailable.
      }
      throw new TaskRepositoryError(
        "INVALID_STORE",
        "Task store failed integrity validation and was cleared.",
      );
    }
  }

  function writeEnvelope(envelope: TaskStoreEnvelope): void {
    if (!isTaskStoreEnvelope(envelope)) {
      throw new TaskRepositoryError(
        "INVALID_STORE",
        "Task store write failed integrity validation.",
      );
    }
    try {
      storage.setItem(TASK_STORE_KEY, JSON.stringify(envelope));
    } catch {
      throw new TaskRepositoryError(
        "VALIDATION",
        "Task store could not persist this change.",
      );
    }
  }

  function storedWorkspace(
    envelope: TaskStoreEnvelope,
    create: boolean,
  ): StoredWorkspace | undefined {
    const key = scopeKey(canonicalScope);
    if (!envelope.workspaces[key] && create) {
      envelope.workspaces[key] = emptyStoredWorkspace();
    }
    return envelope.workspaces[key];
  }

  function allTasks(envelope: TaskStoreEnvelope): TaskDetail[] {
    const seeds = taskFixtures.map(
      (task) => cloneMutable(task) as TaskDetail,
    );
    const created =
      storedWorkspace(envelope, false)?.createdTasks.map(materializeTask) ?? [];
    return [...seeds, ...created];
  }

  return {
    async getTaskPermission(
      taskScope,
      actor,
    ): Promise<TaskPermissionDecision> {
      await prepare(taskScope, actor);
      return cloneMutable(createPermissionDecision(actor));
    },

    async listTasks(
      taskScope,
      actor,
      query = {},
    ): Promise<TaskPage> {
      await prepare(taskScope, actor);
      const { page, pageSize } = validateQuery(query);
      const envelope = readEnvelope();
      const keyword = query.keyword?.trim().toLocaleLowerCase();
      const statuses = filterValues(query.status);
      const templates = filterValues(query.template);
      const risks = filterValues(query.risk);

      const matching = allTasks(envelope)
        .filter(
          (task) =>
            (!keyword ||
              `${task.title}${task.goalSummary}`
                .toLocaleLowerCase()
                .includes(keyword)) &&
            (statuses.length === 0 || statuses.includes(task.status)) &&
            (templates.length === 0 ||
              templates.includes(task.templateName)) &&
            (risks.length === 0 || risks.includes(task.riskLevel)) &&
            matchesOwnership(task, actor, query.ownership),
        )
        .sort(
          (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) ||
            left.id.localeCompare(right.id),
        );
      const start = (page - 1) * pageSize;

      return {
        total: matching.length,
        page,
        pageSize,
        items: matching
          .slice(start, start + pageSize)
          .map(toListItem)
          .map(cloneMutable),
      };
    },

    async getTask(taskScope, actor, taskId): Promise<TaskDetail> {
      await prepare(taskScope, actor);
      if (!isNonEmptyString(taskId)) {
        throw new TaskRepositoryError(
          "VALIDATION",
          "Task ID is invalid.",
        );
      }
      const task = allTasks(readEnvelope()).find(
        (candidate) =>
          candidate.id === taskId &&
          candidate.scope.organizationId === taskScope.organizationId &&
          candidate.scope.workspaceId === taskScope.workspaceId,
      );

      if (!task) {
        throw new TaskRepositoryError("NOT_FOUND", "Task was not found.");
      }
      return cloneMutable(task);
    },

    async getDraft(taskScope, actor): Promise<TaskDraft | undefined> {
      await prepare(taskScope, actor);
      const workspaceStore = storedWorkspace(readEnvelope(), false);
      const draft = workspaceStore?.draftsByActor[actor.userId];
      return draft ? cloneMutable(materializeDraft(draft)) : undefined;
    },

    async saveDraft(taskScope, actor, draft): Promise<TaskDraft> {
      await prepare(taskScope, actor);
      requireWritePermission(actor);
      validateDraftInput(draft);
      const envelope = readEnvelope();
      const workspaceStore = storedWorkspace(envelope, true)!;
      const snapshot = removeUndefinedValues({
        ...cloneMutable(draft),
        updatedAt: currentTimestamp(),
      });
      validateDraftInput(snapshot);
      workspaceStore.draftsByActor[actor.userId] = storeDraft(snapshot);
      writeEnvelope(envelope);
      return cloneMutable(snapshot);
    },

    async discardDraft(taskScope, actor): Promise<void> {
      await prepare(taskScope, actor);
      requireWritePermission(actor);
      const envelope = readEnvelope();
      const workspaceStore = storedWorkspace(envelope, false);
      if (!workspaceStore?.draftsByActor[actor.userId]) {
        return;
      }
      delete workspaceStore.draftsByActor[actor.userId];
      writeEnvelope(envelope);
    },

    async submitTechnicalSolutionTask(
      taskScope,
      actor,
    ): Promise<TaskDetail> {
      await prepare(taskScope, actor);
      requireWritePermission(actor);
      const envelope = readEnvelope();
      const workspaceStore = storedWorkspace(envelope, false);
      const storedDraft = workspaceStore?.draftsByActor[actor.userId];
      const draft = storedDraft ? materializeDraft(storedDraft) : undefined;
      requireCompleteTechnicalSolutionDraft(draft);
      if (envelope.nextTaskSequence === Number.MAX_SAFE_INTEGER) {
        throw new TaskRepositoryError(
          "VALIDATION",
          "Task sequence capacity has been exhausted.",
        );
      }

      const taskId = taskIdFromSequence(envelope.nextTaskSequence);
      const task = createTechnicalSolutionTask(
        taskId,
        actor,
        draft,
        currentTimestamp(),
      );
      const nextEnvelope = cloneMutable(envelope);
      const nextWorkspace = storedWorkspace(nextEnvelope, true)!;
      nextWorkspace.createdTasks.push(storeTask(task));
      delete nextWorkspace.draftsByActor[actor.userId];
      nextEnvelope.nextTaskSequence += 1;
      writeEnvelope(nextEnvelope);
      return cloneMutable(task);
    },
  };
}

function defaultRepository(): TaskRepository {
  return createTaskRepository();
}

export async function getTaskPermission(
  scope: TaskScope,
  actor: TaskActor,
): Promise<TaskPermissionDecision> {
  return defaultRepository().getTaskPermission(scope, actor);
}

export async function listTasks(
  scope: TaskScope,
  actor: TaskActor,
  query: TaskQuery = {},
): Promise<TaskPage> {
  return defaultRepository().listTasks(scope, actor, query);
}

export async function getTask(
  scope: TaskScope,
  actor: TaskActor,
  taskId: string,
): Promise<TaskDetail> {
  return defaultRepository().getTask(scope, actor, taskId);
}

export async function getDraft(
  scope: TaskScope,
  actor: TaskActor,
): Promise<TaskDraft | undefined> {
  return defaultRepository().getDraft(scope, actor);
}

export async function saveDraft(
  scope: TaskScope,
  actor: TaskActor,
  draft: TaskDraft,
): Promise<TaskDraft> {
  return defaultRepository().saveDraft(scope, actor, draft);
}

export async function discardDraft(
  scope: TaskScope,
  actor: TaskActor,
): Promise<void> {
  return defaultRepository().discardDraft(scope, actor);
}

export async function submitTechnicalSolutionTask(
  scope: TaskScope,
  actor: TaskActor,
): Promise<TaskDetail> {
  return defaultRepository().submitTechnicalSolutionTask(scope, actor);
}
