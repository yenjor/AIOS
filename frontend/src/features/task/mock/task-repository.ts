import { organization, users, workspace } from "@/mock/fixtures";
import { resolveEnabledAgentVersionForTask } from "@/features/agent/public-contract";
import { resolveCapabilityVersionForTask } from "@/features/capability/public-contract";

import type {
  AgentAssignment,
  AgentVersionRef,
  ApprovalPoint,
  ArtifactVersionRef,
  CapabilityVersionRef,
  CitationRef,
  ExecutionRun,
  ExecutionStepRecord,
  ExecutionPlan,
  ExpectedArtifact,
  KnowledgeVersionRef,
  PlanStep,
  RuntimeStepResult,
  TaskActor,
  TaskDetail,
  TaskDraft,
  TaskHistoryActor,
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
  WorkflowCheckpoint,
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
  approveTaskPlan(
    scope: TaskScope,
    actor: TaskActor,
    taskId: string,
  ): Promise<TaskDetail>;
  recordExecutionStep(
    scope: TaskScope,
    actor: TaskActor,
    taskId: string,
    result: RuntimeStepResult,
  ): Promise<TaskDetail>;
  recordArtifactAcceptance(
    scope: TaskScope,
    actor: TaskActor,
    taskId: string,
    artifactVersionId: string,
  ): Promise<TaskDetail>;
}

export interface CreateTaskRepositoryOptions {
  storage?: TaskStorage;
  delay?: () => Promise<void>;
  now?: () => string;
}

interface StoredAgentAssignment {
  agentId: string;
  agentName?: string;
  agentVersionRef: VersionRef;
  autonomyLevel: "L0建议" | "L1辅助" | "L2受控执行";
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
  artifactVersionRefs: ArtifactVersionRef[];
  citationRefs: CitationRef[];
  executionRun?: ExecutionRun;
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
      "任务本地演示数据需要浏览器存储边界。",
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
  return isVersionRef(value, "CAPABILITY");
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

function isKnownAgentRef(value: unknown): value is AgentVersionRef {
  return isVersionRef(value, "AGENT");
}

function isKnownHumanOwner(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["userId", "displayName"]) &&
    isKnownUserId(value.userId) &&
    value.userId !== "user-auditor" &&
    users.some(
      ({ id, name }) => id === value.userId && name === value.displayName,
    )
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
    ], ["agentName"]) &&
    isNonEmptyString(value.agentId) &&
    (value.agentName === undefined || isNonEmptyString(value.agentName)) &&
    isKnownAgentRef(value.agentVersionRef) &&
    value.agentVersionRef.objectId === value.agentId &&
    isOneOf(
      value.autonomyLevel,
      ["L0建议", "L1辅助", "L2受控执行"] as const,
    ) &&
    isKnownUserId(value.humanOwnerUserId) &&
    value.humanOwnerUserId !== "user-auditor"
  );
}

function isAgentAssignment(value: unknown): value is AgentAssignment {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "agentId",
      "agentName",
      "agentVersionRef",
      "autonomyLevel",
      "humanOwner",
    ]) &&
    isNonEmptyString(value.agentId) &&
    isNonEmptyString(value.agentName) &&
    isKnownAgentRef(value.agentVersionRef) &&
    value.agentVersionRef.objectId === value.agentId &&
    isOneOf(
      value.autonomyLevel,
      ["L0建议", "L1辅助", "L2受控执行"] as const,
    ) &&
    isKnownHumanOwner(value.humanOwner)
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
      "AI 研发员工",
      "验证",
      "验收人",
    ] as const) &&
    isOneOf(value.riskLevel, RISK_LEVELS)
  );
}

const technicalSolutionPlanStepContract = [
  {
    name: "需求理解与约束确认",
    description: "明确目标、范围、不做事项和验收标准。",
    stepType: "AGENT",
    responsibility: "AI 研发员工",
    riskLevel: "R0",
  },
  {
    name: "代码与模块影响分析",
    description: "只读检索代码结构并识别可能受影响的模块与文件。",
    stepType: "KNOWLEDGE_RETRIEVAL",
    responsibility: "AI 研发员工",
    riskLevel: "R0",
  },
  {
    name: "形成技术方案草稿",
    description: "依据固定能力与知识库版本形成结构化草稿。",
    stepType: "AGENT",
    responsibility: "AI 研发员工",
    riskLevel: "R1",
  },
  {
    name: "方案结构和引用检查",
    description: "检查成果结构、关键结论和知识库引用。",
    stepType: "VALIDATION",
    responsibility: "验证",
    riskLevel: "R1",
  },
  {
    name: "成果人工验收",
    description: "由授权验收人验收技术方案成果。",
    stepType: "HUMAN_REVIEW",
    responsibility: "验收人",
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
  "现有文档为唯一可信来源",
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
    isOneOf(value.name, ["计划确认", "成果验收"] as const) &&
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
    name: "成果验收",
    requiredFor: "ARTIFACT_ACCEPTANCE",
  },
] as const;

function isCanonicalApprovalPoints(
  value: unknown,
  taskId: string,
  taskStatus: TaskStatus,
  reviewerUserId: string,
): value is ApprovalPoint[] {
  const expectedStatuses =
    taskStatus === "NEED_APPROVAL"
      ? (["PENDING", "PENDING"] as const)
      : taskStatus === "COMPLETED"
        ? (["APPROVED", "APPROVED"] as const)
        : (["APPROVED", "PENDING"] as const);
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
        point.status === expectedStatuses[index] &&
        point.reviewerUserIds.length === 1 &&
        point.reviewerUserIds[0] === reviewerUserId
      );
    }) &&
    new Set(value.map((point) => point.id)).size === value.length
  );
}

function isTaskHistoryActor(value: unknown): value is TaskHistoryActor {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["actorType", "actorId"]) &&
    ((value.actorType === "USER" && isKnownUserId(value.actorId)) ||
      (value.actorType === "AGENT" && isNonEmptyString(value.actorId)))
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
    isTaskHistoryActor(value.actor) &&
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
  {
    fromStatus: "NEED_APPROVAL",
    toStatus: "EXECUTING",
    reasonCode: "PLAN_APPROVED_EXECUTION_STARTED",
  },
  {
    fromStatus: "EXECUTING",
    toStatus: "REVIEW",
    reasonCode: "ARTIFACT_SUBMITTED_FOR_REVIEW",
  },
  {
    fromStatus: "REVIEW",
    toStatus: "COMPLETED",
    reasonCode: "ARTIFACT_ACCEPTED_TASK_COMPLETED",
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
  status: TaskStatus,
  agentId: string,
  humanOwnerUserId: string,
): value is TaskHistoryItem[] {
  const expectedLength =
    status === "NEED_APPROVAL"
      ? 4
      : status === "EXECUTING"
        ? 5
        : status === "REVIEW"
          ? 6
          : status === "COMPLETED"
            ? 7
            : 0;
  return (
    Array.isArray(value) &&
    expectedLength > 0 &&
    value.length === expectedLength &&
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
        (index < 4
          ? item.actor.actorType === "USER" &&
            item.actor.actorId === initiatorUserId
          : index === 5
            ? item.actor.actorType === "AGENT" &&
              item.actor.actorId === agentId
            : item.actor.actorType === "USER" &&
              item.actor.actorId === humanOwnerUserId) &&
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

function isArtifactVersionRef(
  value: unknown,
  taskId: string,
): value is ArtifactVersionRef {
  const objectId = `artifact-${taskId}`;
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "kind",
      "objectId",
      "versionId",
      "versionNumber",
      "digest",
      "artifactType",
      "accepted",
    ]) &&
    value.kind === "ARTIFACT" &&
    value.objectId === objectId &&
    value.versionId === `${objectId}-v1` &&
    value.versionNumber === 1 &&
    value.digest === `sha256:${objectId}-v1` &&
    value.artifactType === "技术方案" &&
    typeof value.accepted === "boolean"
  );
}

function isCitationRef(value: unknown): value is CitationRef {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["knowledgeVersionRef", "locator", "digest"]) &&
    isKnownKnowledgeRef(value.knowledgeVersionRef) &&
    value.locator === "README.md#5-系统整体架构" &&
    value.digest ===
      "sha256:citation:knowledge-aios-docs-v1:readme-architecture"
  );
}

function isExecutionStepRecord(
  value: unknown,
  taskId: string,
  index: number,
): value is ExecutionStepRecord {
  if (
    !isRecord(value) ||
    !hasExactKeys(
      value,
      ["stepId", "sequence", "name", "status"],
      [
        "resultType",
        "summary",
        "outputReference",
        "outputDigest",
        "completedAt",
      ],
    ) ||
    value.stepId !==
      `${taskId}-step-${String(index + 1).padStart(2, "0")}` ||
    value.sequence !== index + 1 ||
    value.name !== technicalSolutionPlanStepContract[index].name ||
    !isOneOf(value.status, [
      "PENDING",
      "SUCCEEDED",
      "WAITING_HUMAN",
    ] as const)
  ) {
    return false;
  }

  if (value.status === "PENDING") {
    return (
      value.resultType === undefined &&
      value.summary === undefined &&
      value.outputReference === undefined &&
      value.outputDigest === undefined &&
      value.completedAt === undefined
    );
  }

  if (value.status === "WAITING_HUMAN") {
    return (
      index === 4 &&
      value.resultType === "HUMAN_REVIEW" &&
      value.summary === "等待授权验收人验收成果。" &&
      value.outputReference === undefined &&
      value.outputDigest === undefined &&
      value.completedAt === undefined
    );
  }

  return (
    isOneOf(value.resultType, ["STEP_SUCCEEDED", "ARTIFACT_DRAFT", "HUMAN_REVIEW"] as const) &&
    isNonEmptyString(value.summary) &&
    (value.resultType === "HUMAN_REVIEW"
      ? value.outputReference === undefined &&
        value.outputDigest === undefined
      : isNonEmptyString(value.outputReference) &&
        isNonEmptyString(value.outputDigest)) &&
    isIsoTimestamp(value.completedAt)
  );
}

function isExecutionRun(
  value: unknown,
  taskId: string,
  taskStatus: TaskStatus,
  agentVersionId: string,
  agentId: string,
): value is ExecutionRun {
  if (
    !isRecord(value) ||
    !hasExactKeys(
      value,
      [
        "id",
        "taskId",
        "runNumber",
        "status",
        "workflowVersionId",
        "agentVersionId",
        "executionPackageDigest",
        "idempotencyKey",
        "workerPool",
        "attemptCount",
        "startedAt",
        "steps",
        "checkpoints",
      ],
      [
        "currentStepId",
        "currentCheckpointId",
        "checkpointedAt",
        "finishedAt",
      ],
    ) ||
    value.id !== `run-${taskId}-01` ||
    value.taskId !== taskId ||
    value.runNumber !== 1 ||
    !isOneOf(value.status, ["RUNNING", "SUCCEEDED"] as const) ||
    value.workflowVersionId !== "workflow-technical-solution-v1" ||
    value.agentVersionId !== agentVersionId ||
    value.executionPackageDigest !== `sha256:execution-package-${taskId}-v1` ||
    value.idempotencyKey !== `start-${taskId}-plan-v1` ||
    value.workerPool !== "agent-reasoning" ||
    value.attemptCount !== 1 ||
    !isIsoTimestamp(value.startedAt) ||
    !Array.isArray(value.steps) ||
    value.steps.length !== 5 ||
    !value.steps.every((step, index) =>
      isExecutionStepRecord(step, taskId, index),
    ) ||
    !Array.isArray(value.checkpoints)
  ) {
    return false;
  }

  const steps = value.steps as ExecutionStepRecord[];
  const checkpoints = value.checkpoints as unknown[];
  const completedRuntimeSteps = steps
    .slice(0, 4)
    .filter(({ status: stepStatus }) => stepStatus === "SUCCEEDED").length;
  if (
    checkpoints.length !== completedRuntimeSteps ||
    !checkpoints.every((checkpoint, index) => {
      const step = steps[index];
      return (
        isRecord(checkpoint) &&
        hasExactKeys(checkpoint, [
          "id",
          "sequence",
          "stepId",
          "status",
          "inputDigest",
          "outputReference",
          "outputDigest",
          "createdAt",
          "createdByAgentId",
        ]) &&
        checkpoint.id ===
          `${value.id}-checkpoint-${String(index + 1).padStart(2, "0")}` &&
        checkpoint.sequence === index + 1 &&
        checkpoint.stepId === step.stepId &&
        checkpoint.status === "COMPLETED" &&
        checkpoint.inputDigest ===
          `sha256:${value.executionPackageDigest}:input-step-${index + 1}` &&
        checkpoint.outputReference === step.outputReference &&
        checkpoint.outputDigest === step.outputDigest &&
        checkpoint.createdAt === step.completedAt &&
        checkpoint.createdByAgentId === agentId
      );
    })
  ) {
    return false;
  }

  if (taskStatus === "EXECUTING") {
    const firstPending = steps
      .slice(0, 4)
      .find(({ status: stepStatus }) => stepStatus === "PENDING");
    return (
      value.status === "RUNNING" &&
      firstPending !== undefined &&
      value.currentStepId === firstPending.stepId &&
      value.currentCheckpointId ===
        (completedRuntimeSteps > 0
          ? `${value.id}-checkpoint-${String(completedRuntimeSteps).padStart(2, "0")}`
          : undefined) &&
      value.checkpointedAt ===
        (completedRuntimeSteps > 0
          ? (checkpoints[completedRuntimeSteps - 1] as WorkflowCheckpoint)
              .createdAt
          : undefined) &&
      value.finishedAt === undefined &&
      steps[4].status === "PENDING"
    );
  }

  if (taskStatus === "REVIEW" || taskStatus === "COMPLETED") {
    return (
      value.status === "SUCCEEDED" &&
      completedRuntimeSteps === 4 &&
      value.currentStepId === undefined &&
      value.currentCheckpointId === `${value.id}-checkpoint-04` &&
      value.checkpointedAt ===
        (checkpoints[3] as WorkflowCheckpoint).createdAt &&
      isIsoTimestamp(value.finishedAt) &&
      steps[4].status ===
        (taskStatus === "REVIEW" ? "WAITING_HUMAN" : "SUCCEEDED")
    );
  }

  return false;
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
    : isNonEmptyString(value.actorId);
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
    !hasExactKeys(value, storedTaskRequiredKeys, [
      "currentOwner",
      "executionRun",
    ]) ||
    !isNonEmptyString(value.id) ||
    taskSequenceFromId(value.id) === undefined ||
    !isTaskScope(value.scope) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.goalSummary) ||
    value.templateName !== "生成技术方案" ||
    value.expectedArtifactType !== "技术方案" ||
    !isOneOf(value.status, [
      "NEED_APPROVAL",
      "EXECUTING",
      "REVIEW",
      "COMPLETED",
    ] as const) ||
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
    !isCanonicalApprovalPoints(
      value.approvalPoints,
      taskId,
      value.status as TaskStatus,
      value.assignedAgent.humanOwnerUserId,
    ) ||
    !isExpectedArtifact(value.expectedArtifact) ||
    value.expectedArtifact.artifactType !== "技术方案" ||
    !Array.isArray(value.artifactVersionRefs) ||
    !value.artifactVersionRefs.every((reference) =>
      isArtifactVersionRef(reference, taskId),
    ) ||
    !Array.isArray(value.citationRefs) ||
    !value.citationRefs.every(isCitationRef) ||
    (value.executionRun !== undefined &&
      !isExecutionRun(
        value.executionRun,
        taskId,
        value.status as TaskStatus,
        value.assignedAgent.agentVersionRef.versionId,
        value.assignedAgent.agentId,
      )) ||
    !isCanonicalSubmittedHistory(
      value.history,
      taskId,
      value.initiator.userId,
      createdAt,
      updatedAt,
      value.status as TaskStatus,
      value.assignedAgent.agentId,
      value.assignedAgent.humanOwnerUserId,
    ) ||
    value.aggregateVersion !== (value.history as TaskHistoryItem[]).length
  ) {
    return false;
  }

  return (
    value.expectedArtifact.sections.join("|") ===
      goldenTechnicalSolutionTask.expectedArtifact.sections.join("|") &&
    value.expectedArtifact.knowledgeCitationRequired &&
    (value.status === "NEED_APPROVAL"
      ? value.executionRun === undefined &&
        value.currentOwner === undefined &&
        value.artifactVersionRefs.length === 0 &&
        value.citationRefs.length === 0
      : value.status === "EXECUTING"
        ? isExecutionRun(
            value.executionRun,
            taskId,
            "EXECUTING",
            value.assignedAgent.agentVersionRef.versionId,
            value.assignedAgent.agentId,
          ) &&
          isRecord(value.currentOwner) &&
          value.currentOwner.actorType === "AGENT" &&
          value.currentOwner.actorId === value.assignedAgent.agentId &&
          value.artifactVersionRefs.length === 0 &&
          value.citationRefs.length === 0
        : value.status === "REVIEW"
          ? isExecutionRun(
              value.executionRun,
              taskId,
              "REVIEW",
              value.assignedAgent.agentVersionRef.versionId,
              value.assignedAgent.agentId,
            ) &&
            isRecord(value.currentOwner) &&
            value.currentOwner.actorType === "USER" &&
            value.currentOwner.actorId ===
              value.assignedAgent.humanOwnerUserId &&
            value.artifactVersionRefs.length === 1 &&
            value.artifactVersionRefs[0].accepted === false &&
            value.citationRefs.length === 1
          : isExecutionRun(
              value.executionRun,
              taskId,
              "COMPLETED",
              value.assignedAgent.agentVersionRef.versionId,
              value.assignedAgent.agentId,
            ) &&
            value.currentOwner === undefined &&
            value.artifactVersionRefs.length === 1 &&
            value.artifactVersionRefs[0].accepted === true &&
            value.citationRefs.length === 1)
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
    throw new TaskRepositoryError("INVALID_STORE", "已存储的任务身份信息无效。");
  }
  return user.name;
}

function materializeAgentAssignment(
  assignment: StoredAgentAssignment,
): AgentAssignment {
  return {
    agentId: assignment.agentId,
    agentName: assignment.agentName ?? "AI 研发员工",
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
    agentName: assignment.agentName,
    agentVersionRef: cloneMutable(assignment.agentVersionRef),
    autonomyLevel: assignment.autonomyLevel,
    humanOwnerUserId: assignment.humanOwner.userId,
  };
}

function materializeTaskOwner(
  owner: StoredTaskOwner,
  agentName = "AI 研发员工",
): TaskOwner {
  return owner.actorType === "AGENT"
    ? {
        actorType: "AGENT",
        actorId: owner.actorId,
        displayName: agentName,
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
      ? materializeTaskOwner(
          task.currentOwner,
          task.assignedAgent.agentName ?? "AI 研发员工",
        )
      : undefined,
    assignedAgentName: task.assignedAgent.agentName ?? "AI 研发员工",
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
      "已提交任务必须包含固定执行引用。",
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
    artifactVersionRefs: cloneMutable(task.artifactVersionRefs),
    citationRefs: cloneMutable(task.citationRefs),
    executionRun: task.executionRun
      ? cloneMutable(task.executionRun)
      : undefined,
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
      "任务作用域无效。",
    );
  }

  if (
    scope.organizationId !== canonicalScope.organizationId ||
    scope.workspaceId !== canonicalScope.workspaceId ||
    workspace.organizationId !== organization.id
  ) {
    throw new TaskRepositoryError("NOT_FOUND", "未找到任务作用域。");
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
      "任务执行主体无效。",
    );
  }

  if (!validActorIds.has(actor.userId)) {
    throw new TaskRepositoryError(
      "FORBIDDEN",
      "当前执行主体不能访问此任务作用域。",
    );
  }
}

function createPermissionDecision(actor: TaskActor): TaskPermissionDecision {
  const allowed = writableActorIds.has(actor.userId);
  return {
    allowed,
    code: allowed ? "ALLOWED" : "FORBIDDEN",
    reason: allowed
      ? "工作空间成员可以创建模拟任务。"
      : "审计员仅具有任务只读权限。",
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
      "任务草稿包含不支持的字段。",
    );
  }

  if (!isTaskDraftInput(draft)) {
    throw new TaskRepositoryError(
      "VALIDATION",
      "任务草稿字段无效。",
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
      "预期成果与任务模板不匹配。",
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
      "提交前必须完成任务创建的五个步骤。",
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
    throw new TaskRepositoryError("VALIDATION", "任务查询条件无效。");
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
    throw new TaskRepositoryError("VALIDATION", "任务查询条件无效。");
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
      actor: {
        actorType: "USER",
        actorId: actor.userId,
      },
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
    assignedAgentName: draft.assignedAgent.agentName,
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
      reviewerUserIds: [draft.assignedAgent.humanOwner.userId],
    })),
    expectedArtifact: cloneMutable(draft.expectedArtifact),
    artifactVersionRefs: [],
    citationRefs: [],
    history,
    aggregateVersion: 4,
  };
}

function createExecutionRun(task: TaskDetail, timestamp: string): ExecutionRun {
  if (!task.executionPlan || !task.workflowVersionRef || !task.assignedAgent) {
    throw new TaskRepositoryError(
      "VALIDATION",
      "任务执行必须固定计划、工作流和 AI 员工版本。",
    );
  }
  const runId = `run-${task.id}-01`;
  return {
    id: runId,
    taskId: task.id,
    runNumber: 1,
    status: "RUNNING",
    workflowVersionId: task.workflowVersionRef.versionId,
    agentVersionId: task.assignedAgent.agentVersionRef.versionId,
    executionPackageDigest: `sha256:execution-package-${task.id}-v1`,
    currentStepId: task.executionPlan.steps[0].id,
    idempotencyKey: `start-${task.id}-plan-v1`,
    workerPool: "agent-reasoning",
    attemptCount: 1,
    startedAt: timestamp,
    steps: task.executionPlan.steps.map((step) => ({
      stepId: step.id,
      sequence: step.sequence,
      name: step.name,
      status: "PENDING",
    })),
    checkpoints: [],
  };
}

function appendTransition(
  task: TaskDetail,
  toStatus: TaskStatus,
  reasonCode: string,
  actor: TaskHistoryActor,
  timestamp: string,
): void {
  const nextAggregateVersion = task.aggregateVersion + 1;
  task.history.push({
    id: `${task.id}-transition-${String(nextAggregateVersion).padStart(2, "0")}`,
    fromStatus: task.status,
    toStatus,
    reasonCode,
    actor: cloneMutable(actor),
    occurredAt: timestamp,
    aggregateVersion: nextAggregateVersion,
  });
  task.status = toStatus;
  task.aggregateVersion = nextAggregateVersion;
  task.updatedAt = timestamp;
}

function validateRuntimeStepResult(
  result: unknown,
): asserts result is RuntimeStepResult {
  if (
    !isRecord(result) ||
    !hasExactKeys(
      result,
      [
        "stepId",
        "resultType",
        "summary",
        "outputReference",
        "outputDigest",
      ],
      ["artifactVersionRef", "citationRefs"],
    ) ||
    !isNonEmptyString(result.stepId) ||
    !isOneOf(result.resultType, [
      "STEP_SUCCEEDED",
      "ARTIFACT_DRAFT",
    ] as const) ||
    !isNonEmptyString(result.summary) ||
    !isNonEmptyString(result.outputReference) ||
    !isNonEmptyString(result.outputDigest)
  ) {
    throw new TaskRepositoryError(
      "VALIDATION",
      "运行时步骤结果无效。",
    );
  }

  if (
    result.resultType === "ARTIFACT_DRAFT" &&
    (!isRecord(result.artifactVersionRef) ||
      !Array.isArray(result.citationRefs))
  ) {
    throw new TaskRepositoryError(
      "VALIDATION",
      "成果步骤必须包含成果版本引用和知识引用证据。",
    );
  }

  if (
    result.resultType === "STEP_SUCCEEDED" &&
    (result.artifactVersionRef !== undefined ||
      result.citationRefs !== undefined)
  ) {
    throw new TaskRepositoryError(
      "VALIDATION",
      "普通步骤不能附加成果证据。",
    );
  }
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
        "任务时钟必须返回 ISO 8601 UTC 时间戳。",
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
        "任务存储不可用。",
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
        // 无法清理时，默认拒绝错误保持权威性。
      }
      throw new TaskRepositoryError(
        "INVALID_STORE",
        "任务存储未通过完整性校验，已清除不可信数据。",
      );
    }
  }

  function writeEnvelope(envelope: TaskStoreEnvelope): void {
    if (!isTaskStoreEnvelope(envelope)) {
      throw new TaskRepositoryError(
        "INVALID_STORE",
        "任务存储写入未通过完整性校验。",
      );
    }
    try {
      storage.setItem(TASK_STORE_KEY, JSON.stringify(envelope));
    } catch {
      throw new TaskRepositoryError(
        "VALIDATION",
        "任务存储无法持久化本次变更。",
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

  function mutableCreatedTask(
    envelope: TaskStoreEnvelope,
    taskId: string,
  ): {
    workspaceStore: StoredWorkspace;
    taskIndex: number;
    task: TaskDetail;
  } {
    const workspaceStore = storedWorkspace(envelope, false);
    const taskIndex =
      workspaceStore?.createdTasks.findIndex(({ id }) => id === taskId) ?? -1;
    if (!workspaceStore || taskIndex < 0) {
      throw new TaskRepositoryError(
        "NOT_FOUND",
        "只能修改当前工作空间内已提交的任务。",
      );
    }
    return {
      workspaceStore,
      taskIndex,
      task: materializeTask(workspaceStore.createdTasks[taskIndex]),
    };
  }

  function requireReviewer(task: TaskDetail, actor: TaskActor): void {
    if (!task.reviewerUserIds.includes(actor.userId)) {
      throw new TaskRepositoryError(
        "FORBIDDEN",
        "当前执行主体不是此任务的授权验收人。",
      );
    }
  }

  function requireRuntimeController(
    task: TaskDetail,
    actor: TaskActor,
  ): void {
    if (task.assignedAgent?.humanOwner.userId !== actor.userId) {
      throw new TaskRepositoryError(
        "FORBIDDEN",
        "只有 AI 员工的人工负责人可以推进受控 AI 员工运行时。",
      );
    }
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
          "任务标识无效。",
        );
      }
      const task = allTasks(readEnvelope()).find(
        (candidate) =>
          candidate.id === taskId &&
          candidate.scope.organizationId === taskScope.organizationId &&
          candidate.scope.workspaceId === taskScope.workspaceId,
      );

      if (!task) {
        throw new TaskRepositoryError("NOT_FOUND", "未找到任务。");
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
      let resolvedCapability;
      try {
        resolvedCapability = await resolveCapabilityVersionForTask(
          taskScope,
          actor,
          draft.capabilityVersionRefs[0].versionId,
          "GENERATE_TECHNICAL_DESIGN",
        );
      } catch {
        throw new TaskRepositoryError(
          "VALIDATION",
          "所选能力版本当前未发布或未获授权。",
        );
      }
      if (
        !matchesVersionRef(
          draft.capabilityVersionRefs[0],
          resolvedCapability.versionRef,
          "CAPABILITY",
        )
      ) {
        throw new TaskRepositoryError(
          "VALIDATION",
          "所选能力版本引用未通过摘要校验。",
        );
      }
      let resolvedAgent;
      try {
        resolvedAgent = await resolveEnabledAgentVersionForTask(
          taskScope,
          actor,
          draft.assignedAgent.agentVersionRef.versionId,
          "GENERATE_TECHNICAL_DESIGN",
          draft.capabilityVersionRefs[0].versionId,
        );
      } catch {
        throw new TaskRepositoryError(
          "VALIDATION",
          "所选 AI 员工版本未启用、未发布、未分配到该能力版本或未获授权。",
        );
      }
      if (
        draft.assignedAgent.agentId !== resolvedAgent.agentId ||
        draft.assignedAgent.agentName !== resolvedAgent.agentName ||
        draft.assignedAgent.autonomyLevel !== resolvedAgent.autonomyLevel ||
        draft.assignedAgent.humanOwner.userId !==
          resolvedAgent.humanOwner.userId ||
        draft.assignedAgent.humanOwner.displayName !==
          resolvedAgent.humanOwner.displayName ||
        !matchesVersionRef(
          draft.assignedAgent.agentVersionRef,
          resolvedAgent.agentVersionRef,
          "AGENT",
        )
      ) {
        throw new TaskRepositoryError(
          "VALIDATION",
          "所选 AI 员工版本分配未通过身份或摘要校验。",
        );
      }
      if (envelope.nextTaskSequence === Number.MAX_SAFE_INTEGER) {
        throw new TaskRepositoryError(
          "VALIDATION",
          "任务序列容量已耗尽。",
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

    async approveTaskPlan(taskScope, actor, taskId): Promise<TaskDetail> {
      await prepare(taskScope, actor);
      requireWritePermission(actor);
      const nextEnvelope = cloneMutable(readEnvelope());
      const mutable = mutableCreatedTask(nextEnvelope, taskId);
      const task = mutable.task;
      requireReviewer(task, actor);
      if (
        task.status !== "NEED_APPROVAL" ||
        task.executionRun !== undefined
      ) {
        throw new TaskRepositoryError(
          "VALIDATION",
          "只有正在等待当前计划审批的任务可以开始执行。",
        );
      }
      const planApproval = task.approvalPoints.find(
        ({ requiredFor }) => requiredFor === "PLAN_EXECUTION",
      );
      if (!planApproval || planApproval.status !== "PENDING") {
        throw new TaskRepositoryError(
          "VALIDATION",
          "计划审批点不可用。",
        );
      }
      const timestamp = currentTimestamp();
      planApproval.status = "APPROVED";
      task.executionRun = createExecutionRun(task, timestamp);
      task.currentOwner = {
        actorType: "AGENT",
        actorId: task.assignedAgent!.agentId,
        displayName: task.assignedAgent!.agentName,
      };
      appendTransition(
        task,
        "EXECUTING",
        "PLAN_APPROVED_EXECUTION_STARTED",
        { actorType: "USER", actorId: actor.userId },
        timestamp,
      );
      mutable.workspaceStore.createdTasks[mutable.taskIndex] =
        storeTask(task);
      writeEnvelope(nextEnvelope);
      return cloneMutable(task);
    },

    async recordExecutionStep(
      taskScope,
      actor,
      taskId,
      result,
    ): Promise<TaskDetail> {
      await prepare(taskScope, actor);
      requireWritePermission(actor);
      validateRuntimeStepResult(result);
      const nextEnvelope = cloneMutable(readEnvelope());
      const mutable = mutableCreatedTask(nextEnvelope, taskId);
      const task = mutable.task;
      requireRuntimeController(task, actor);

      const existingResult = task.executionRun?.steps.find(
        ({ stepId }) => stepId === result.stepId,
      );
      if (
        existingResult?.status === "SUCCEEDED" &&
        existingResult.outputDigest === result.outputDigest
      ) {
        return cloneMutable(task);
      }
      if (
        task.status !== "EXECUTING" ||
        !task.executionRun ||
        task.executionRun.status !== "RUNNING"
      ) {
        throw new TaskRepositoryError(
          "VALIDATION",
          "任务没有活动中的执行记录。",
        );
      }

      const nextStep = task.executionRun.steps
        .slice(0, 4)
        .find(({ status }) => status === "PENDING");
      if (!nextStep || nextStep.stepId !== result.stepId) {
        throw new TaskRepositoryError(
          "VALIDATION",
          "运行时步骤结果顺序不正确。",
        );
      }
      if (
        (nextStep.sequence === 4) !==
        (result.resultType === "ARTIFACT_DRAFT")
      ) {
        throw new TaskRepositoryError(
          "VALIDATION",
          "运行时步骤结果类型与固定工作流不匹配。",
        );
      }

      const timestamp = currentTimestamp();
      nextStep.status = "SUCCEEDED";
      nextStep.resultType = result.resultType;
      nextStep.summary = result.summary;
      nextStep.outputReference = result.outputReference;
      nextStep.outputDigest = result.outputDigest;
      nextStep.completedAt = timestamp;
      const checkpointSequence = task.executionRun.checkpoints.length + 1;
      const checkpointId = `${task.executionRun.id}-checkpoint-${String(checkpointSequence).padStart(2, "0")}`;
      task.executionRun.checkpoints.push({
        id: checkpointId,
        sequence: checkpointSequence,
        stepId: nextStep.stepId,
        status: "COMPLETED",
        inputDigest: `sha256:${task.executionRun.executionPackageDigest}:input-step-${nextStep.sequence}`,
        outputReference: result.outputReference,
        outputDigest: result.outputDigest,
        createdAt: timestamp,
        createdByAgentId: task.assignedAgent!.agentId,
      });
      task.executionRun.currentCheckpointId = checkpointId;
      task.executionRun.checkpointedAt = timestamp;
      task.updatedAt = timestamp;

      if (result.resultType === "ARTIFACT_DRAFT") {
        if (
          !isArtifactVersionRef(result.artifactVersionRef, taskId) ||
          result.artifactVersionRef.accepted ||
          !Array.isArray(result.citationRefs) ||
          result.citationRefs.length !== 1 ||
          !result.citationRefs.every(isCitationRef)
        ) {
          throw new TaskRepositoryError(
            "VALIDATION",
            "成果步骤证据无效。",
          );
        }
        task.executionRun.status = "SUCCEEDED";
        delete task.executionRun.currentStepId;
        task.executionRun.finishedAt = timestamp;
        const humanReviewStep = task.executionRun.steps[4];
        humanReviewStep.status = "WAITING_HUMAN";
        humanReviewStep.resultType = "HUMAN_REVIEW";
        humanReviewStep.summary = "等待授权验收人验收成果。";
        task.artifactVersionRefs = [
          cloneMutable(result.artifactVersionRef),
        ];
        task.citationRefs = cloneMutable(result.citationRefs);
        task.currentOwner = {
          actorType: "USER",
          actorId: task.assignedAgent!.humanOwner.userId,
          displayName: task.assignedAgent!.humanOwner.displayName,
        };
        appendTransition(
          task,
          "REVIEW",
          "ARTIFACT_SUBMITTED_FOR_REVIEW",
          {
            actorType: "AGENT",
            actorId: task.assignedAgent!.agentId,
          },
          timestamp,
        );
      } else {
        const followingStep = task.executionRun.steps
          .slice(0, 4)
          .find(({ status }) => status === "PENDING");
        if (!followingStep) {
          throw new TaskRepositoryError(
            "VALIDATION",
            "固定工作流要求在验收前先完成成果步骤。",
          );
        }
        task.executionRun.currentStepId = followingStep.stepId;
      }

      mutable.workspaceStore.createdTasks[mutable.taskIndex] =
        storeTask(task);
      writeEnvelope(nextEnvelope);
      return cloneMutable(task);
    },

    async recordArtifactAcceptance(
      taskScope,
      actor,
      taskId,
      artifactVersionId,
    ): Promise<TaskDetail> {
      await prepare(taskScope, actor);
      requireWritePermission(actor);
      const nextEnvelope = cloneMutable(readEnvelope());
      const mutable = mutableCreatedTask(nextEnvelope, taskId);
      const task = mutable.task;
      requireReviewer(task, actor);
      const artifactRef = task.artifactVersionRefs.find(
        ({ versionId }) => versionId === artifactVersionId,
      );
      if (
        task.status === "COMPLETED" &&
        artifactRef?.accepted === true
      ) {
        return cloneMutable(task);
      }
      if (
        task.status !== "REVIEW" ||
        !task.executionRun ||
        task.executionRun.status !== "SUCCEEDED" ||
        !artifactRef ||
        artifactRef.accepted
      ) {
        throw new TaskRepositoryError(
          "VALIDATION",
          "任务当前并未等待本次成果验收。",
        );
      }
      const artifactApproval = task.approvalPoints.find(
        ({ requiredFor }) => requiredFor === "ARTIFACT_ACCEPTANCE",
      );
      if (!artifactApproval || artifactApproval.status !== "PENDING") {
        throw new TaskRepositoryError(
          "VALIDATION",
          "成果验收点不可用。",
        );
      }

      const timestamp = currentTimestamp();
      artifactRef.accepted = true;
      artifactApproval.status = "APPROVED";
      const humanReviewStep = task.executionRun.steps[4];
      humanReviewStep.status = "SUCCEEDED";
      humanReviewStep.resultType = "HUMAN_REVIEW";
      humanReviewStep.summary =
        `${task.assignedAgent!.humanOwner.displayName}（${task.assignedAgent!.humanOwner.userId}）已依据完成标准验收成果。`;
      humanReviewStep.completedAt = timestamp;
      delete task.currentOwner;
      appendTransition(
        task,
        "COMPLETED",
        "ARTIFACT_ACCEPTED_TASK_COMPLETED",
        { actorType: "USER", actorId: actor.userId },
        timestamp,
      );
      mutable.workspaceStore.createdTasks[mutable.taskIndex] =
        storeTask(task);
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

export async function approveTaskPlan(
  scope: TaskScope,
  actor: TaskActor,
  taskId: string,
): Promise<TaskDetail> {
  return defaultRepository().approveTaskPlan(scope, actor, taskId);
}

export async function recordExecutionStep(
  scope: TaskScope,
  actor: TaskActor,
  taskId: string,
  result: RuntimeStepResult,
): Promise<TaskDetail> {
  return defaultRepository().recordExecutionStep(
    scope,
    actor,
    taskId,
    result,
  );
}

export async function recordArtifactAcceptance(
  scope: TaskScope,
  actor: TaskActor,
  taskId: string,
  artifactVersionId: string,
): Promise<TaskDetail> {
  return defaultRepository().recordArtifactAcceptance(
    scope,
    actor,
    taskId,
    artifactVersionId,
  );
}
