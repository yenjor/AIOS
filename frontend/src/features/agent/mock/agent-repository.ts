import {
  listPublishedCapabilityOptions,
  resolvePublishedCapabilityVersion,
} from "@/features/capability/mock/capability-repository";
import {
  listPublishedToolActionOptions,
  resolvePublishedToolActionOption,
} from "@/features/tool/mock/tool-repository";
import type {
  CapabilitySelectionOption,
  CapabilityTaskType,
  CapabilityVersionRef,
} from "@/features/capability/model";
import { users } from "@/mock/fixtures";

import type {
  Agent,
  AgentActor,
  AgentListItem,
  AgentPage,
  AgentPermissionDecision,
  AgentQuery,
  AgentScope,
  AgentSelectionOption,
  AgentStatus,
  AgentSummary,
  AgentTestSummary,
  AgentVersion,
  AgentVersionStatus,
  AutonomyLevel,
  CreateAgentInput,
} from "../model";
import { toAgentVersionRef } from "../model";

export const AGENT_STORE_KEY = "aios.mock.agent-store.v2";
const STORE_SCHEMA_VERSION = 1;
const DEFAULT_LATENCY_MS = 30;

export type AgentRepositoryErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_STORE"
  | "VALIDATION"
  | "CONFLICT"
  | "IMMUTABLE_AGENT_VERSION"
  | "AGENT_NOT_PUBLISHABLE";

export class AgentRepositoryError extends Error {
  constructor(
    public readonly code: AgentRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AgentRepositoryError";
  }
}

export interface AgentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AgentRepository {
  getPermission(
    scope: AgentScope,
    actor: AgentActor,
  ): Promise<AgentPermissionDecision>;
  listAgents(
    scope: AgentScope,
    actor: AgentActor,
    query?: AgentQuery,
  ): Promise<AgentPage>;
  getSummary(scope: AgentScope, actor: AgentActor): Promise<AgentSummary>;
  getAgent(
    scope: AgentScope,
    actor: AgentActor,
    agentId: string,
  ): Promise<Agent>;
  createAgent(
    scope: AgentScope,
    actor: AgentActor,
    input: CreateAgentInput,
  ): Promise<Agent>;
  createVersion(
    scope: AgentScope,
    actor: AgentActor,
    agentId: string,
  ): Promise<Agent>;
  testVersion(
    scope: AgentScope,
    actor: AgentActor,
    agentId: string,
    versionId: string,
  ): Promise<Agent>;
  publishVersion(
    scope: AgentScope,
    actor: AgentActor,
    agentId: string,
    versionId: string,
  ): Promise<Agent>;
  suspendAgent(
    scope: AgentScope,
    actor: AgentActor,
    agentId: string,
    reason: string,
  ): Promise<Agent>;
  resumeAgent(
    scope: AgentScope,
    actor: AgentActor,
    agentId: string,
  ): Promise<Agent>;
  disableAgent(
    scope: AgentScope,
    actor: AgentActor,
    agentId: string,
  ): Promise<Agent>;
  listEnabledOptions(
    scope: AgentScope,
    actor: AgentActor,
    taskType: CapabilityTaskType,
  ): Promise<AgentSelectionOption[]>;
  resolveAgentVersion(
    scope: AgentScope,
    actor: AgentActor,
    versionId: string,
    taskType: CapabilityTaskType,
    capabilityVersionId: string,
  ): Promise<AgentSelectionOption>;
}

export interface CreateAgentRepositoryOptions {
  storage?: AgentStorage;
  delay?: () => Promise<void>;
  now?: () => string;
}

interface AgentStoreEnvelope {
  schemaVersion: 1;
  nextAgentSequence: number;
  items: Agent[];
}

const canonicalScope: AgentScope = {
  organizationId: "org-guangwei",
  workspaceId: "ws-ai",
};
const validActorIds = new Set(users.map(({ id }) => id));
const managerActorIds = new Set(["user-lead", "user-admin"]);
const usableActorIds = new Set([
  "user-pm",
  "user-dev",
  "user-lead",
  "user-admin",
]);
const agentStatuses = new Set<AgentStatus>([
  "DRAFT",
  "TESTING",
  "ENABLED",
  "SUSPENDED",
  "DISABLED",
]);
const versionStatuses = new Set<AgentVersionStatus>([
  "DRAFT",
  "PUBLISHED",
  "RETIRED",
]);
const autonomyLevels = new Set<AutonomyLevel>([
  "L0建议",
  "L1辅助",
  "L2受控执行",
]);
const taskTypes: CapabilityTaskType[] = [
  "GENERATE_TECHNICAL_DESIGN",
  "ANALYZE_REQUIREMENT",
  "CODE_REVIEW",
  "AUTOMATED_TEST",
];

function defaultDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, DEFAULT_LATENCY_MS));
}

function getBrowserStorage(): AgentStorage {
  if (typeof window === "undefined") {
    throw new AgentRepositoryError(
      "INVALID_STORE",
      "AI 员工中心仅可在浏览器 Mock Runtime 中使用。",
    );
  }
  return window.localStorage;
}

function cloneMutable<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.endsWith("Z") &&
    !Number.isNaN(Date.parse(value))
  );
}

function stableDigest(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `sha256:mock-${(hash >>> 0).toString(16).padStart(8, "0")}-${value
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36)
    .toLowerCase()}`;
}

function validateScope(scope: AgentScope): void {
  if (
    scope.organizationId !== canonicalScope.organizationId ||
    scope.workspaceId !== canonicalScope.workspaceId
  ) {
    throw new AgentRepositoryError(
      "NOT_FOUND",
      "AI 员工作用域不可用。",
    );
  }
}

function validateActor(actor: AgentActor): void {
  if (!validActorIds.has(actor.userId)) {
    throw new AgentRepositoryError(
      "FORBIDDEN",
      "AI 员工操作身份不可用。",
    );
  }
}

function permissionFor(actor: AgentActor): AgentPermissionDecision {
  const canManage = managerActorIds.has(actor.userId);
  return {
    canRead: true,
    canUse: usableActorIds.has(actor.userId),
    canManage,
    canGovern: canManage,
    reason: canManage
      ? "当前身份可创建、测试、发布和治理 Workspace 内的 AI 员工。"
      : actor.userId === "user-auditor"
        ? "Auditor 仅可查看 AgentVersion、Assignment 与治理证据。"
        : "当前身份可在 Task 中使用已启用 AI 员工，不能修改配置。",
  };
}

function requireManager(actor: AgentActor): void {
  if (!managerActorIds.has(actor.userId)) {
    throw new AgentRepositoryError(
      "FORBIDDEN",
      "只有 Workspace Admin 或 Agent Builder 可执行此操作。",
    );
  }
}

function userName(userId: string): string {
  return users.find(({ id }) => id === userId)?.name ?? userId;
}

function technicalCapabilityRef(): CapabilityVersionRef {
  return {
    kind: "CAPABILITY",
    objectId: "capability-technical-solution",
    versionId: "capability-technical-solution-v1",
    versionNumber: 1,
    digest: "sha256:capability-technical-solution-v1",
  };
}

function buildVersion({
  agentId,
  versionNumber,
  input,
  capabilityAssignments,
  acceptedTaskTypes,
  actorId,
  timestamp,
  supersedesVersionId,
}: {
  agentId: string;
  versionNumber: number;
  input: CreateAgentInput;
  capabilityAssignments: CapabilityVersionRef[];
  acceptedTaskTypes: CapabilityTaskType[];
  actorId: string;
  timestamp: string;
  supersedesVersionId?: string;
}): AgentVersion {
  const versionId = `${agentId}-v${versionNumber}`;
  const distinctTaskTypes = Array.from(new Set(acceptedTaskTypes));
  const toolGrantReferences = Array.from(
    new Map(
      input.toolGrantReferences.map((reference) => [
        `${reference.toolVersionId}:${reference.action}`,
        reference,
      ]),
    ).values(),
  );
  const digest =
    agentId === "agent-rd-001" && versionNumber === 1
      ? "sha256:agent-rd-001-v1"
      : stableDigest(
          `${versionId}:${input.humanOwnerId}:${capabilityAssignments
            .map(({ versionId: capabilityVersionId }) => capabilityVersionId)
            .sort()
            .join(",")}:${input.autonomyLevel}`,
        );

  return {
    id: versionId,
    versionNumber,
    status: "DRAFT",
    schemaVersion: 1,
    contentDigest: digest,
    humanOwnerId: input.humanOwnerId,
    profile: {
      jobTitle: input.jobTitle,
      jobFamily: "software_engineering",
      roleDescription: input.roleDescription,
      acceptedTaskTypes: distinctTaskTypes,
      expectedArtifactTypes: distinctTaskTypes.map((taskType) => {
        switch (taskType) {
          case "GENERATE_TECHNICAL_DESIGN":
            return "TECHNICAL_DESIGN";
          case "ANALYZE_REQUIREMENT":
            return "REQUIREMENT_ANALYSIS";
          case "CODE_REVIEW":
            return "CODE_REVIEW_REPORT";
          case "AUTOMATED_TEST":
            return "TEST_REPORT";
        }
      }),
      responsibilityBoundary:
        "仅在固定 Task、CapabilityVersion、Workspace 与 Permission 交集内生成 Artifact Draft。",
      humanCollaboration:
        "由 Human Owner 负责计划批准、异常接管与 Artifact 验收。",
      escalationPolicy:
        "缺少信息进入 NeedInput；越权或高风险动作停止并请求人工。",
      dataClassificationCeiling: "INTERNAL",
      permanentProhibitions: [
        "不得自行增加 Capability、知识范围、Tool Grant 或 Permission",
        "不得接受自己产生且需要职责分离的 Artifact",
        "不得修改 Task、知识库、Audit 或 Human Owner 事实",
      ],
    },
    workspaceAssignments: [
      {
        workspaceId: canonicalScope.workspaceId,
        assignmentType: "SERVES",
        scopeDigest: stableDigest(
          `${canonicalScope.organizationId}:${canonicalScope.workspaceId}`,
        ),
      },
    ],
    capabilityAssignments: cloneMutable(capabilityAssignments),
    knowledgeScopeAssignments: input.includeKnowledgeScope
      ? [
          {
            organizationId: canonicalScope.organizationId,
            workspaceId: canonicalScope.workspaceId,
            purpose: "software_engineering_tasks",
            classificationCeiling: "INTERNAL",
            citationRequired: true,
            scopeDigest: stableDigest(
              `${canonicalScope.workspaceId}:knowledge:internal`,
            ),
          },
        ]
      : [],
    toolGrantReferences: toolGrantReferences.map((reference) => ({
      ...cloneMutable(reference),
      scopeDigest: stableDigest(
        `${canonicalScope.workspaceId}:tool:${reference.toolVersionId}:${reference.action}`,
      ),
    })),
    autonomyLevel: input.autonomyLevel,
    permissionRequirements: [
      { resource: "TASK", action: "READ", scope: "CURRENT_WORKSPACE" },
      ...(input.includeKnowledgeScope
        ? [
            {
              resource: "KNOWLEDGE" as const,
              action: "READ" as const,
              scope: "CURRENT_WORKSPACE" as const,
            },
          ]
        : []),
      ...toolGrantReferences.map(() => ({
        resource: "TOOL" as const,
        action: "USE" as const,
        scope: "CURRENT_WORKSPACE" as const,
      })),
      {
        resource: "ARTIFACT",
        action: "CREATE_DRAFT",
        scope: "CURRENT_WORKSPACE",
      },
    ],
    testSummaries: [],
    ...(supersedesVersionId ? { supersedesVersionId } : {}),
    createdAt: timestamp,
    createdBy: actorId,
  };
}

function passingTest(
  version: AgentVersion,
  actorId: string,
  timestamp: string,
): AgentTestSummary {
  return {
    id: `${version.id}-test-${version.testSummaries.length + 1}`,
    result: "PASSED",
    capabilityAssignmentsValid: true,
    knowledgeScopeValid: true,
    toolGrantValid: true,
    permissionNegativePassed: true,
    artifactDraftPassed: true,
    promptInjectionPassed: true,
    evidenceReference: `mock://agent-test/${version.id}/summary`,
    evidenceDigest: stableDigest(`${version.contentDigest}:agent-test:passed`),
    testedAt: timestamp,
    testedBy: actorId,
  };
}

function seedAgent({
  id,
  code,
  name,
  roleDescription,
  ownerId,
  status,
  timestamp,
  taskIds = [],
}: {
  id: string;
  code: string;
  name: string;
  roleDescription: string;
  ownerId: string;
  status: AgentStatus;
  timestamp: string;
  taskIds?: string[];
}): Agent {
  const input: CreateAgentInput = {
    code,
    name,
    roleDescription,
    humanOwnerId: ownerId,
    jobTitle: name,
    capabilityVersionIds: ["capability-technical-solution-v1"],
    autonomyLevel: "L1辅助",
    includeKnowledgeScope: true,
    toolGrantReferences: [
      {
        toolId: "tool-codegraph-read",
        toolVersionId: "tool-codegraph-read-v1",
        toolVersionDigest: "sha256:tool-codegraph-read-v1",
        action: "codegraph.context",
        actionDigest: "sha256:codegraph-context-action-v1",
        operationType: "READ",
        riskCeiling: "R0",
      },
    ],
  };
  const version = buildVersion({
    agentId: id,
    versionNumber: 1,
    input,
    capabilityAssignments: [technicalCapabilityRef()],
    acceptedTaskTypes: ["GENERATE_TECHNICAL_DESIGN"],
    actorId: "user-lead",
    timestamp,
  });
  if (["ENABLED", "SUSPENDED"].includes(status)) {
    version.testSummaries = [
      passingTest(version, "mock-agent-test-worker", timestamp),
    ];
    version.status = "PUBLISHED";
    version.publishedAt = timestamp;
    version.publishedBy = "user-lead";
  } else if (status === "TESTING") {
    version.testSummaries = [
      passingTest(version, "mock-agent-test-worker", timestamp),
    ];
  }
  return {
    id,
    scope: cloneMutable(canonicalScope),
    code,
    name,
    roleDescription,
    humanOwnerId: ownerId,
    status,
    ...(["ENABLED", "SUSPENDED"].includes(status)
      ? { publishedVersionId: version.id }
      : {}),
    versions: [version],
    referencedTaskIds: taskIds,
    aggregateVersion: 1,
    createdAt: timestamp,
    createdBy: "user-lead",
    updatedAt: timestamp,
    updatedBy: "user-lead",
    ...(status === "SUSPENDED"
      ? {
          suspendedAt: timestamp,
          suspendedBy: "user-admin",
          suspensionReason:
            "Tool Health 事件待复核，已阻止新的 Task Assignment。",
        }
      : {}),
  };
}

function defaultEnvelope(): AgentStoreEnvelope {
  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    nextAgentSequence: 4,
    items: [
      seedAgent({
        id: "agent-rd-001",
        code: "AI_RD_EMPLOYEE",
        name: "AI研发员工",
        roleDescription:
          "理解研发任务，读取授权知识和代码上下文，生成可验收的研发 Artifact。",
        ownerId: "user-lead",
        status: "ENABLED",
        timestamp: "2026-07-25T09:45:00.000Z",
        taskIds: ["task-golden-technical-solution"],
      }),
      seedAgent({
        id: "agent-quality-001",
        code: "AI_QUALITY_REVIEWER",
        name: "AI质量审查助手",
        roleDescription:
          "在只读范围内检查交付证据并生成质量审查报告草稿。",
        ownerId: "user-lead",
        status: "SUSPENDED",
        timestamp: "2026-07-24T12:30:00.000Z",
      }),
      seedAgent({
        id: "agent-research-001",
        code: "AI_RESEARCH_ASSISTANT",
        name: "AI技术调研助手",
        roleDescription:
          "整理授权技术资料并形成供 Human Owner 审查的技术调研草稿。",
        ownerId: "user-dev",
        status: "TESTING",
        timestamp: "2026-07-25T14:00:00.000Z",
      }),
    ],
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isCapabilityReference(
  value: unknown,
): value is CapabilityVersionRef {
  return (
    isRecord(value) &&
    value.kind === "CAPABILITY" &&
    isNonEmptyString(value.objectId) &&
    isNonEmptyString(value.versionId) &&
    Number.isSafeInteger(value.versionNumber) &&
    (value.versionNumber as number) > 0 &&
    isNonEmptyString(value.digest) &&
    value.digest.startsWith("sha256:")
  );
}

function isStoredAgentVersion(
  value: unknown,
  agentId: string,
): value is AgentVersion {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.versionNumber) ||
    (value.versionNumber as number) < 1 ||
    value.id !== `${agentId}-v${value.versionNumber}` ||
    !versionStatuses.has(value.status as AgentVersionStatus) ||
    value.schemaVersion !== 1 ||
    !isNonEmptyString(value.contentDigest) ||
    !value.contentDigest.startsWith("sha256:") ||
    !isNonEmptyString(value.humanOwnerId) ||
    !validActorIds.has(value.humanOwnerId) ||
    value.humanOwnerId === "user-auditor" ||
    !autonomyLevels.has(value.autonomyLevel as AutonomyLevel) ||
    !isIsoTimestamp(value.createdAt) ||
    !isNonEmptyString(value.createdBy)
  ) {
    return false;
  }

  const profile = value.profile;
  if (
    !isRecord(profile) ||
    !isNonEmptyString(profile.jobTitle) ||
    profile.jobFamily !== "software_engineering" ||
    !isNonEmptyString(profile.roleDescription) ||
    !Array.isArray(profile.acceptedTaskTypes) ||
    profile.acceptedTaskTypes.length === 0 ||
    !profile.acceptedTaskTypes.every((taskType) =>
      taskTypes.includes(taskType as CapabilityTaskType),
    ) ||
    new Set(profile.acceptedTaskTypes).size !==
      profile.acceptedTaskTypes.length ||
    !isStringArray(profile.expectedArtifactTypes) ||
    !isNonEmptyString(profile.responsibilityBoundary) ||
    !isNonEmptyString(profile.humanCollaboration) ||
    !isNonEmptyString(profile.escalationPolicy) ||
    profile.dataClassificationCeiling !== "INTERNAL" ||
    !isStringArray(profile.permanentProhibitions)
  ) {
    return false;
  }

  if (
    !Array.isArray(value.workspaceAssignments) ||
    value.workspaceAssignments.length !== 1 ||
    !value.workspaceAssignments.every(
      (assignment) =>
        isRecord(assignment) &&
        assignment.workspaceId === canonicalScope.workspaceId &&
        assignment.assignmentType === "SERVES" &&
        isNonEmptyString(assignment.scopeDigest),
    ) ||
    !Array.isArray(value.capabilityAssignments) ||
    value.capabilityAssignments.length === 0 ||
    !value.capabilityAssignments.every(isCapabilityReference) ||
    new Set(
      value.capabilityAssignments.map(
        (assignment) => assignment.versionId,
      ),
    ).size !== value.capabilityAssignments.length
  ) {
    return false;
  }

  if (
    !Array.isArray(value.knowledgeScopeAssignments) ||
    !value.knowledgeScopeAssignments.every(
      (assignment) =>
        isRecord(assignment) &&
        assignment.organizationId === canonicalScope.organizationId &&
        assignment.workspaceId === canonicalScope.workspaceId &&
        assignment.purpose === "software_engineering_tasks" &&
        assignment.classificationCeiling === "INTERNAL" &&
        assignment.citationRequired === true &&
        isNonEmptyString(assignment.scopeDigest),
    ) ||
    !Array.isArray(value.toolGrantReferences) ||
    !value.toolGrantReferences.every(
      (grant) =>
        isRecord(grant) &&
        isNonEmptyString(grant.toolId) &&
        isNonEmptyString(grant.toolVersionId) &&
        isNonEmptyString(grant.toolVersionDigest) &&
        isNonEmptyString(grant.action) &&
        isNonEmptyString(grant.actionDigest) &&
        grant.operationType === "READ" &&
        (grant.riskCeiling === "R0" || grant.riskCeiling === "R1") &&
        isNonEmptyString(grant.scopeDigest),
    ) ||
    !Array.isArray(value.permissionRequirements) ||
    !value.permissionRequirements.every(
      (requirement) =>
        isRecord(requirement) &&
        ["TASK", "KNOWLEDGE", "TOOL", "ARTIFACT"].includes(
          String(requirement.resource),
        ) &&
        ["READ", "USE", "CREATE_DRAFT"].includes(
          String(requirement.action),
        ) &&
        requirement.scope === "CURRENT_WORKSPACE",
    )
  ) {
    return false;
  }

  if (
    !Array.isArray(value.testSummaries) ||
    !value.testSummaries.every(
      (test) =>
        isRecord(test) &&
        isNonEmptyString(test.id) &&
        ["PASSED", "FAILED", "BLOCKED"].includes(String(test.result)) &&
        typeof test.capabilityAssignmentsValid === "boolean" &&
        typeof test.knowledgeScopeValid === "boolean" &&
        typeof test.toolGrantValid === "boolean" &&
        typeof test.permissionNegativePassed === "boolean" &&
        typeof test.artifactDraftPassed === "boolean" &&
        typeof test.promptInjectionPassed === "boolean" &&
        isNonEmptyString(test.evidenceReference) &&
        isNonEmptyString(test.evidenceDigest) &&
        test.evidenceDigest.startsWith("sha256:") &&
        isIsoTimestamp(test.testedAt) &&
        isNonEmptyString(test.testedBy),
    )
  ) {
    return false;
  }

  if (value.status === "PUBLISHED" || value.status === "RETIRED") {
    const latestTest = value.testSummaries.at(-1);
    if (
      !isIsoTimestamp(value.publishedAt) ||
      !isNonEmptyString(value.publishedBy) ||
      !isRecord(latestTest) ||
      latestTest.result !== "PASSED"
    ) {
      return false;
    }
  }
  if (
    value.status === "RETIRED" &&
    (!isIsoTimestamp(value.retiredAt) || !isNonEmptyString(value.retiredBy))
  ) {
    return false;
  }
  return (
    (value.supersedesVersionId === undefined ||
      isNonEmptyString(value.supersedesVersionId)) &&
    (value.status !== "DRAFT" ||
      (value.publishedAt === undefined &&
        value.publishedBy === undefined &&
        value.retiredAt === undefined &&
        value.retiredBy === undefined))
  );
}

function isStoredAgent(value: unknown): value is Agent {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !/^[A-Z][A-Z0-9_]{2,63}$/.test(String(value.code)) ||
    !isNonEmptyString(value.name) ||
    !isNonEmptyString(value.roleDescription) ||
    !isNonEmptyString(value.humanOwnerId) ||
    !validActorIds.has(value.humanOwnerId) ||
    value.humanOwnerId === "user-auditor" ||
    !agentStatuses.has(value.status as AgentStatus) ||
    !Array.isArray(value.versions) ||
    value.versions.length === 0 ||
    !value.versions.every((version) =>
      isStoredAgentVersion(version, value.id as string),
    ) ||
    !isStringArray(value.referencedTaskIds) ||
    !Number.isSafeInteger(value.aggregateVersion) ||
    (value.aggregateVersion as number) < 1 ||
    !isIsoTimestamp(value.createdAt) ||
    !isNonEmptyString(value.createdBy) ||
    !isIsoTimestamp(value.updatedAt) ||
    !isNonEmptyString(value.updatedBy) ||
    value.updatedAt < value.createdAt
  ) {
    return false;
  }
  const versions = value.versions as AgentVersion[];
  if (
    new Set(versions.map(({ id }) => id)).size !== versions.length ||
    new Set(versions.map(({ versionNumber }) => versionNumber)).size !==
      versions.length
  ) {
    return false;
  }
  if (value.status === "ENABLED" || value.status === "SUSPENDED") {
    const published = versions.find(
      ({ id }) => id === value.publishedVersionId,
    );
    if (!published || published.status !== "PUBLISHED") return false;
  }
  if (
    value.status === "SUSPENDED" &&
    (!isIsoTimestamp(value.suspendedAt) ||
      !isNonEmptyString(value.suspendedBy) ||
      !isNonEmptyString(value.suspensionReason))
  ) {
    return false;
  }
  if (
    value.status === "DISABLED" &&
    (!isIsoTimestamp(value.disabledAt) || !isNonEmptyString(value.disabledBy))
  ) {
    return false;
  }
  return true;
}

function isAgentEnvelope(value: unknown): value is AgentStoreEnvelope {
  return (
    isRecord(value) &&
    value.schemaVersion === STORE_SCHEMA_VERSION &&
    Number.isSafeInteger(value.nextAgentSequence) &&
    (value.nextAgentSequence as number) >= 4 &&
    Array.isArray(value.items) &&
    value.items.length >= 3 &&
    value.items.every(isStoredAgent) &&
    new Set(value.items.map((agent) => agent.id)).size ===
      value.items.length &&
    new Set(value.items.map((agent) => agent.code)).size ===
      value.items.length
  );
}

function validateInput(input: CreateAgentInput): void {
  if (
    !/^[A-Z][A-Z0-9_]{2,63}$/.test(input.code) ||
    !isNonEmptyString(input.name) ||
    !isNonEmptyString(input.roleDescription) ||
    !validActorIds.has(input.humanOwnerId) ||
    input.humanOwnerId === "user-auditor" ||
    !isNonEmptyString(input.jobTitle) ||
    !Array.isArray(input.capabilityVersionIds) ||
    input.capabilityVersionIds.length === 0 ||
    !input.capabilityVersionIds.every(isNonEmptyString) ||
    !autonomyLevels.has(input.autonomyLevel) ||
    !Array.isArray(input.toolGrantReferences) ||
    !input.toolGrantReferences.every(
      (reference) =>
        isRecord(reference) &&
        isNonEmptyString(reference.toolId) &&
        isNonEmptyString(reference.toolVersionId) &&
        isNonEmptyString(reference.toolVersionDigest) &&
        isNonEmptyString(reference.action) &&
        isNonEmptyString(reference.actionDigest) &&
        reference.operationType === "READ" &&
        (reference.riskCeiling === "R0" ||
          reference.riskCeiling === "R1"),
    )
  ) {
    throw new AgentRepositoryError(
      "VALIDATION",
      "Agent Profile、Human Owner、Capability Assignment 或 AutonomyLevel 不完整。",
    );
  }
}

async function visiblePublishedCapabilities(
  scope: AgentScope,
  actor: AgentActor,
): Promise<CapabilitySelectionOption[]> {
  const pages = await Promise.all(
    taskTypes.map((taskType) =>
      listPublishedCapabilityOptions(scope, actor, taskType),
    ),
  );
  const byVersion = new Map<string, CapabilitySelectionOption>();
  for (const option of pages.flat()) {
    byVersion.set(option.versionRef.versionId, option);
  }
  return [...byVersion.values()];
}

async function resolveAssignments(
  scope: AgentScope,
  actor: AgentActor,
  versionIds: string[],
): Promise<{
  refs: CapabilityVersionRef[];
  options: CapabilitySelectionOption[];
}> {
  const options = await visiblePublishedCapabilities(scope, actor);
  const selected = versionIds.map((versionId) =>
    options.find((option) => option.versionRef.versionId === versionId),
  );
  if (selected.some((option) => !option)) {
    throw new AgentRepositoryError(
      "VALIDATION",
      "Capability Assignment 包含未发布、已暂停或无权使用的版本。",
    );
  }
  return {
    refs: selected.map((option) => cloneMutable(option!.versionRef)),
    options: selected as CapabilitySelectionOption[],
  };
}

async function validateToolGrants(
  scope: AgentScope,
  actor: AgentActor,
  grants: CreateAgentInput["toolGrantReferences"],
): Promise<void> {
  const resolved = await Promise.all(
    grants.map((grant) =>
      resolvePublishedToolActionOption(
        scope,
        actor,
        grant.toolVersionId,
        grant.action,
      ),
    ),
  );
  const valid = resolved.every((option, index) => {
    const grant = grants[index];
    return (
      option.toolId === grant.toolId &&
      option.toolVersionDigest === grant.toolVersionDigest &&
      option.actionDigest === grant.actionDigest &&
      option.operationType === grant.operationType &&
      option.riskLevel === grant.riskCeiling
    );
  });
  if (!valid) {
    throw new AgentRepositoryError(
      "VALIDATION",
      "Tool Grant 包含未发布、Health 不可用或 Digest 不匹配的 Action。",
    );
  }
}

function latestVersion(agent: Agent): AgentVersion {
  return agent.versions.reduce((latest, version) =>
    version.versionNumber > latest.versionNumber ? version : latest,
  );
}

function toListItem(agent: Agent): AgentListItem {
  const current =
    agent.versions.find(({ id }) => id === agent.publishedVersionId) ??
    latestVersion(agent);
  const test = current.testSummaries.at(-1);
  return {
    id: agent.id,
    code: agent.code,
    name: agent.name,
    roleDescription: agent.roleDescription,
    humanOwnerId: agent.humanOwnerId,
    status: agent.status,
    currentVersionId: current.id,
    currentVersionNumber: current.versionNumber,
    versionStatus: current.status,
    autonomyLevel: current.autonomyLevel,
    taskTypes: cloneMutable(current.profile.acceptedTaskTypes),
    capabilityCount: current.capabilityAssignments.length,
    taskUsageCount: agent.referencedTaskIds.length,
    ...(test ? { testResult: test.result } : {}),
    updatedAt: agent.updatedAt,
  };
}

function toSelectionOption(
  agent: Agent,
  version: AgentVersion,
): AgentSelectionOption {
  return {
    agentId: agent.id,
    agentName: agent.name,
    roleDescription: agent.roleDescription,
    humanOwner: {
      userId: agent.humanOwnerId,
      displayName: userName(agent.humanOwnerId),
    },
    autonomyLevel: version.autonomyLevel,
    agentVersionRef: toAgentVersionRef(agent, version),
    capabilityVersionRefs: cloneMutable(version.capabilityAssignments),
    acceptedTaskTypes: cloneMutable(version.profile.acceptedTaskTypes),
    knowledgeScopeCount: version.knowledgeScopeAssignments.length,
    toolActions: version.toolGrantReferences.map(({ action }) => action),
  };
}

export function createAgentRepository(
  options: CreateAgentRepositoryOptions = {},
): AgentRepository {
  const storage = options.storage ?? getBrowserStorage();
  const delay = options.delay ?? defaultDelay;
  const now = options.now ?? (() => new Date().toISOString());

  async function prepare(scope: AgentScope, actor: AgentActor) {
    await delay();
    validateScope(scope);
    validateActor(actor);
  }

  function readEnvelope(): AgentStoreEnvelope {
    let raw: string | null;
    try {
      raw = storage.getItem(AGENT_STORE_KEY);
    } catch {
      throw new AgentRepositoryError(
        "INVALID_STORE",
        "AI 员工数据不可用。",
      );
    }
    if (raw === null) {
      return defaultEnvelope();
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isAgentEnvelope(parsed)) {
        throw new Error("invalid");
      }
      return parsed;
    } catch {
      try {
        storage.removeItem(AGENT_STORE_KEY);
      } catch {
        // Fail closed even when cleanup is unavailable.
      }
      throw new AgentRepositoryError(
        "INVALID_STORE",
        "AI 员工本地数据未通过完整性校验，已拒绝加载。",
      );
    }
  }

  function writeEnvelope(envelope: AgentStoreEnvelope): void {
    if (!isAgentEnvelope(envelope)) {
      throw new AgentRepositoryError(
        "INVALID_STORE",
        "AI 员工写入未通过完整性校验。",
      );
    }
    storage.setItem(AGENT_STORE_KEY, JSON.stringify(envelope));
  }

  function findMutable(envelope: AgentStoreEnvelope, agentId: string): Agent {
    const agent = envelope.items.find(({ id }) => id === agentId);
    if (!agent || agent.scope.workspaceId !== canonicalScope.workspaceId) {
      throw new AgentRepositoryError(
        "NOT_FOUND",
        "AI 员工在当前 Workspace 中不可用。",
      );
    }
    return agent;
  }

  function mutate(
    envelope: AgentStoreEnvelope,
    agent: Agent,
    actor: AgentActor,
    timestamp: string,
  ): Agent {
    agent.aggregateVersion += 1;
    agent.updatedAt = timestamp;
    agent.updatedBy = actor.userId;
    writeEnvelope(envelope);
    return cloneMutable(agent);
  }

  return {
    async getPermission(scope, actor) {
      await prepare(scope, actor);
      return cloneMutable(permissionFor(actor));
    },

    async listAgents(scope, actor, query = {}) {
      await prepare(scope, actor);
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
      const keyword = query.keyword?.trim().toLocaleLowerCase();
      const items = readEnvelope()
        .items.map(toListItem)
        .filter(
          (item) =>
            (!keyword ||
              `${item.name}${item.code}${item.roleDescription}`
                .toLocaleLowerCase()
                .includes(keyword)) &&
            (!query.status || item.status === query.status) &&
            (!query.autonomyLevel ||
              item.autonomyLevel === query.autonomyLevel) &&
            (!query.taskType || item.taskTypes.includes(query.taskType)),
        )
        .sort(
          (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) ||
            left.id.localeCompare(right.id),
        );
      return {
        total: items.length,
        page,
        pageSize,
        items: cloneMutable(
          items.slice((page - 1) * pageSize, page * pageSize),
        ),
      };
    },

    async getSummary(scope, actor) {
      await prepare(scope, actor);
      const items = readEnvelope().items.map(toListItem);
      return {
        total: items.length,
        enabled: items.filter(({ status }) => status === "ENABLED").length,
        testing: items.filter(({ status }) => status === "TESTING").length,
        attention: items.filter(({ status }) =>
          ["SUSPENDED", "DISABLED"].includes(status),
        ).length,
      };
    },

    async getAgent(scope, actor, agentId) {
      await prepare(scope, actor);
      return cloneMutable(findMutable(readEnvelope(), agentId));
    },

    async createAgent(scope, actor, input) {
      await prepare(scope, actor);
      requireManager(actor);
      validateInput(input);
      const assignments = await resolveAssignments(
        scope,
        actor,
        input.capabilityVersionIds,
      );
      await validateToolGrants(scope, actor, input.toolGrantReferences);
      const grantedActions = new Set(
        input.toolGrantReferences.map(({ action }) => action),
      );
      const missingRequiredActions = Array.from(
        new Set(
          assignments.options
            .flatMap(({ toolActions }) => toolActions)
            .filter((action) => !grantedActions.has(action)),
        ),
      );
      if (missingRequiredActions.length > 0) {
        throw new AgentRepositoryError(
          "VALIDATION",
          `Capability Assignment 缺少已发布 Tool Grant：${missingRequiredActions.join(", ")}`,
        );
      }
      if (
        assignments.options.some(({ knowledgeRequired }) => knowledgeRequired) &&
        !input.includeKnowledgeScope
      ) {
        throw new AgentRepositoryError(
          "VALIDATION",
          "Capability Assignment 需要当前 Workspace Knowledge Scope。",
        );
      }
      const envelope = readEnvelope();
      if (
        envelope.items.some(
          ({ code }) =>
            code.toLocaleLowerCase() === input.code.toLocaleLowerCase(),
        )
      ) {
        throw new AgentRepositoryError(
          "CONFLICT",
          "Agent Code 在当前 Workspace 中必须唯一。",
        );
      }
      const id = `agent-custom-${String(envelope.nextAgentSequence).padStart(3, "0")}`;
      const timestamp = now();
      const version = buildVersion({
        agentId: id,
        versionNumber: 1,
        input,
        capabilityAssignments: assignments.refs,
        acceptedTaskTypes: assignments.options.map(({ taskType }) => taskType),
        actorId: actor.userId,
        timestamp,
      });
      const agent: Agent = {
        id,
        scope: cloneMutable(canonicalScope),
        code: input.code,
        name: input.name.trim(),
        roleDescription: input.roleDescription.trim(),
        humanOwnerId: input.humanOwnerId,
        status: "DRAFT",
        versions: [version],
        referencedTaskIds: [],
        aggregateVersion: 1,
        createdAt: timestamp,
        createdBy: actor.userId,
        updatedAt: timestamp,
        updatedBy: actor.userId,
      };
      envelope.items.push(agent);
      envelope.nextAgentSequence += 1;
      writeEnvelope(envelope);
      return cloneMutable(agent);
    },

    async createVersion(scope, actor, agentId) {
      await prepare(scope, actor);
      requireManager(actor);
      const envelope = readEnvelope();
      const agent = findMutable(envelope, agentId);
      if (agent.status === "DISABLED") {
        throw new AgentRepositoryError(
          "CONFLICT",
          "Disabled Agent 不允许创建新版本。",
        );
      }
      if (latestVersion(agent).status === "DRAFT") {
        throw new AgentRepositoryError(
          "CONFLICT",
          "已有 Draft AgentVersion，请先完成测试与发布。",
        );
      }
      const source =
        agent.versions.find(({ id }) => id === agent.publishedVersionId) ??
        latestVersion(agent);
      const input: CreateAgentInput = {
        code: agent.code,
        name: agent.name,
        roleDescription: agent.roleDescription,
        humanOwnerId: agent.humanOwnerId,
        jobTitle: source.profile.jobTitle,
        capabilityVersionIds: source.capabilityAssignments.map(
          ({ versionId }) => versionId,
        ),
        autonomyLevel: source.autonomyLevel,
        includeKnowledgeScope:
          source.knowledgeScopeAssignments.length > 0,
        toolGrantReferences: source.toolGrantReferences.map((reference) => ({
          toolId: reference.toolId,
          toolVersionId: reference.toolVersionId,
          toolVersionDigest: reference.toolVersionDigest,
          action: reference.action,
          actionDigest: reference.actionDigest,
          operationType: reference.operationType,
          riskCeiling: reference.riskCeiling,
        })),
      };
      const timestamp = now();
      agent.versions.push(
        buildVersion({
          agentId: agent.id,
          versionNumber: source.versionNumber + 1,
          input,
          capabilityAssignments: source.capabilityAssignments,
          acceptedTaskTypes: source.profile.acceptedTaskTypes,
          actorId: actor.userId,
          timestamp,
          supersedesVersionId: source.id,
        }),
      );
      return mutate(envelope, agent, actor, timestamp);
    },

    async testVersion(scope, actor, agentId, versionId) {
      await prepare(scope, actor);
      requireManager(actor);
      const envelope = readEnvelope();
      const agent = findMutable(envelope, agentId);
      const version = agent.versions.find(({ id }) => id === versionId);
      if (!version || version.status !== "DRAFT") {
        throw new AgentRepositoryError(
          "CONFLICT",
          "只有 Draft AgentVersion 可运行确定性测试。",
        );
      }
      for (const assignment of version.capabilityAssignments) {
        let isResolvable = false;
        for (const candidate of version.profile.acceptedTaskTypes) {
          try {
            const resolved = await resolvePublishedCapabilityVersion(
              scope,
              actor,
              assignment.versionId,
              candidate,
            );
            if (
              resolved.versionRef.objectId === assignment.objectId &&
              resolved.versionRef.versionNumber === assignment.versionNumber &&
              resolved.versionRef.digest === assignment.digest
            ) {
              isResolvable = true;
              break;
            }
          } catch {
            // Try the next declared task type.
          }
        }
        if (!isResolvable) {
          throw new AgentRepositoryError(
            "VALIDATION",
            "AgentVersion 包含不可解析的 Capability Assignment。",
          );
        }
      }
      const timestamp = now();
      version.testSummaries.push(
        passingTest(version, "mock-agent-test-worker", timestamp),
      );
      if (agent.status === "DRAFT") {
        agent.status = "TESTING";
      }
      return mutate(envelope, agent, actor, timestamp);
    },

    async publishVersion(scope, actor, agentId, versionId) {
      await prepare(scope, actor);
      requireManager(actor);
      const envelope = readEnvelope();
      const agent = findMutable(envelope, agentId);
      const version = agent.versions.find(({ id }) => id === versionId);
      const test = version?.testSummaries.at(-1);
      if (
        !version ||
        version.status !== "DRAFT" ||
        test?.result !== "PASSED" ||
        !test.capabilityAssignmentsValid ||
        !test.knowledgeScopeValid ||
        !test.toolGrantValid ||
        !test.permissionNegativePassed ||
        !test.artifactDraftPassed ||
        !test.promptInjectionPassed
      ) {
        throw new AgentRepositoryError(
          "AGENT_NOT_PUBLISHABLE",
          "Capability、知识、Tool、Permission、安全测试与 Artifact Draft 门禁必须全部通过。",
        );
      }
      if (agent.status === "SUSPENDED") {
        throw new AgentRepositoryError(
          "CONFLICT",
          "Suspended Agent 必须先完成风险复核与恢复。",
        );
      }
      const timestamp = now();
      const previous = agent.versions.find(
        ({ id }) => id === agent.publishedVersionId,
      );
      version.status = "PUBLISHED";
      version.publishedAt = timestamp;
      version.publishedBy = actor.userId;
      agent.publishedVersionId = version.id;
      agent.status = "ENABLED";
      if (previous && previous.id !== version.id) {
        previous.status = "RETIRED";
        previous.retiredAt = timestamp;
        previous.retiredBy = actor.userId;
      }
      return mutate(envelope, agent, actor, timestamp);
    },

    async suspendAgent(scope, actor, agentId, reason) {
      await prepare(scope, actor);
      requireManager(actor);
      if (!isNonEmptyString(reason)) {
        throw new AgentRepositoryError(
          "VALIDATION",
          "暂停原因不能为空。",
        );
      }
      const envelope = readEnvelope();
      const agent = findMutable(envelope, agentId);
      if (agent.status !== "ENABLED") {
        throw new AgentRepositoryError(
          "CONFLICT",
          "只有 Enabled Agent 可以暂停。",
        );
      }
      const timestamp = now();
      agent.status = "SUSPENDED";
      agent.suspendedAt = timestamp;
      agent.suspendedBy = actor.userId;
      agent.suspensionReason = reason.trim();
      return mutate(envelope, agent, actor, timestamp);
    },

    async resumeAgent(scope, actor, agentId) {
      await prepare(scope, actor);
      requireManager(actor);
      const envelope = readEnvelope();
      const agent = findMutable(envelope, agentId);
      if (agent.status !== "SUSPENDED" || !agent.publishedVersionId) {
        throw new AgentRepositoryError(
          "CONFLICT",
          "只有保留 Published AgentVersion 的 Suspended Agent 可恢复。",
        );
      }
      const timestamp = now();
      agent.status = "ENABLED";
      delete agent.suspendedAt;
      delete agent.suspendedBy;
      delete agent.suspensionReason;
      return mutate(envelope, agent, actor, timestamp);
    },

    async disableAgent(scope, actor, agentId) {
      await prepare(scope, actor);
      requireManager(actor);
      const envelope = readEnvelope();
      const agent = findMutable(envelope, agentId);
      if (!["ENABLED", "SUSPENDED"].includes(agent.status)) {
        throw new AgentRepositoryError(
          "CONFLICT",
          "只有 Enabled 或 Suspended Agent 可有序停用。",
        );
      }
      if (agent.referencedTaskIds.length > 0) {
        throw new AgentRepositoryError(
          "CONFLICT",
          "仍有历史或活动 Task 引用；MVP 不允许直接停用该 Agent。",
        );
      }
      const timestamp = now();
      agent.status = "DISABLED";
      agent.disabledAt = timestamp;
      agent.disabledBy = actor.userId;
      return mutate(envelope, agent, actor, timestamp);
    },

    async listEnabledOptions(scope, actor, taskType) {
      await prepare(scope, actor);
      if (!usableActorIds.has(actor.userId)) {
        return [];
      }
      const capabilities = await listPublishedCapabilityOptions(
        scope,
        actor,
        taskType,
      );
      const toolOptions = await listPublishedToolActionOptions(scope, actor);
      const availableToolGrants = new Set(
        toolOptions.map(
          (option) =>
            `${option.toolVersionId}:${option.toolVersionDigest}:${option.action}:${option.actionDigest}`,
        ),
      );
      const publishedByVersion = new Map(
        capabilities.map((option) => [
          option.versionRef.versionId,
          option,
        ]),
      );
      return readEnvelope()
        .items.flatMap((agent) => {
          if (agent.status !== "ENABLED" || !agent.publishedVersionId) {
            return [];
          }
          const version = agent.versions.find(
            ({ id }) => id === agent.publishedVersionId,
          );
          if (
            !version ||
            version.status !== "PUBLISHED" ||
            !version.profile.acceptedTaskTypes.includes(taskType)
          ) {
            return [];
          }
          const validAssignments = version.capabilityAssignments.filter(
            (reference) => {
              const option = publishedByVersion.get(reference.versionId);
              const published = option?.versionRef;
              return (
                published &&
                published.objectId === reference.objectId &&
                published.versionNumber === reference.versionNumber &&
                published.digest === reference.digest &&
                (!option.knowledgeRequired ||
                  version.knowledgeScopeAssignments.length > 0) &&
                version.toolGrantReferences.every((grant) =>
                  availableToolGrants.has(
                    `${grant.toolVersionId}:${grant.toolVersionDigest}:${grant.action}:${grant.actionDigest}`,
                  ),
                ) &&
                option.toolActions.every((action) =>
                  version.toolGrantReferences.some(
                    (grant) => grant.action === action,
                  ),
                )
              );
            },
          );
          if (validAssignments.length === 0) {
            return [];
          }
          return [
            toSelectionOption(agent, {
              ...version,
              capabilityAssignments: validAssignments,
            }),
          ];
        })
        .sort((left, right) =>
          left.agentName.localeCompare(right.agentName, "zh-CN"),
        );
    },

    async resolveAgentVersion(
      scope,
      actor,
      versionId,
      taskType,
      capabilityVersionId,
    ) {
      const options = await this.listEnabledOptions(scope, actor, taskType);
      const option = options.find(
        (candidate) =>
          candidate.agentVersionRef.versionId === versionId &&
          candidate.capabilityVersionRefs.some(
            (reference) => reference.versionId === capabilityVersionId,
          ),
      );
      if (!option) {
        throw new AgentRepositoryError(
          "NOT_FOUND",
          "AgentVersion 未发布、Agent 未启用、Capability 未绑定或当前身份无权使用。",
        );
      }
      return cloneMutable(option);
    },
  };
}

function repository(): AgentRepository {
  return createAgentRepository();
}

export const getAgentPermission = (
  scope: AgentScope,
  actor: AgentActor,
) => repository().getPermission(scope, actor);

export const listAgents = (
  scope: AgentScope,
  actor: AgentActor,
  query: AgentQuery = {},
) => repository().listAgents(scope, actor, query);

export const getAgentSummary = (
  scope: AgentScope,
  actor: AgentActor,
) => repository().getSummary(scope, actor);

export const getAgent = (
  scope: AgentScope,
  actor: AgentActor,
  agentId: string,
) => repository().getAgent(scope, actor, agentId);

export const createAgent = (
  scope: AgentScope,
  actor: AgentActor,
  input: CreateAgentInput,
) => repository().createAgent(scope, actor, input);

export const createAgentVersion = (
  scope: AgentScope,
  actor: AgentActor,
  agentId: string,
) => repository().createVersion(scope, actor, agentId);

export const testAgentVersion = (
  scope: AgentScope,
  actor: AgentActor,
  agentId: string,
  versionId: string,
) => repository().testVersion(scope, actor, agentId, versionId);

export const publishAgentVersion = (
  scope: AgentScope,
  actor: AgentActor,
  agentId: string,
  versionId: string,
) => repository().publishVersion(scope, actor, agentId, versionId);

export const suspendAgent = (
  scope: AgentScope,
  actor: AgentActor,
  agentId: string,
  reason: string,
) => repository().suspendAgent(scope, actor, agentId, reason);

export const resumeAgent = (
  scope: AgentScope,
  actor: AgentActor,
  agentId: string,
) => repository().resumeAgent(scope, actor, agentId);

export const disableAgent = (
  scope: AgentScope,
  actor: AgentActor,
  agentId: string,
) => repository().disableAgent(scope, actor, agentId);

export const listEnabledAgentOptions = (
  scope: AgentScope,
  actor: AgentActor,
  taskType: CapabilityTaskType,
) => repository().listEnabledOptions(scope, actor, taskType);

export const resolveAgentVersionForTask = (
  scope: AgentScope,
  actor: AgentActor,
  versionId: string,
  taskType: CapabilityTaskType,
  capabilityVersionId: string,
) =>
  repository().resolveAgentVersion(
    scope,
    actor,
    versionId,
    taskType,
    capabilityVersionId,
  );
