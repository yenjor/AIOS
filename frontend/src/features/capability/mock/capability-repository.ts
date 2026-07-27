import { users } from "@/mock/fixtures";

import type {
  Capability,
  CapabilityActor,
  CapabilityListItem,
  CapabilityPage,
  CapabilityPermissionDecision,
  CapabilityQuery,
  CapabilityReleaseStatus,
  CapabilityScope,
  CapabilitySelectionOption,
  CapabilitySummary,
  CapabilityTaskType,
  CapabilityVersion,
  CreateCapabilityInput,
  EvaluationSummary,
} from "../model";
import { toCapabilityVersionRef } from "../model";

export const CAPABILITY_STORE_KEY = "aios.mock.capability-store.v1";
const STORE_SCHEMA_VERSION = 1;
const DEFAULT_LATENCY_MS = 30;

export type CapabilityRepositoryErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_STORE"
  | "VALIDATION"
  | "CONFLICT"
  | "IMMUTABLE_CAPABILITY_VERSION"
  | "CAPABILITY_NOT_PUBLISHABLE";

export class CapabilityRepositoryError extends Error {
  constructor(
    public readonly code: CapabilityRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CapabilityRepositoryError";
  }
}

export interface CapabilityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CapabilityRepository {
  getPermission(
    scope: CapabilityScope,
    actor: CapabilityActor,
  ): Promise<CapabilityPermissionDecision>;
  listCapabilities(
    scope: CapabilityScope,
    actor: CapabilityActor,
    query?: CapabilityQuery,
  ): Promise<CapabilityPage>;
  getSummary(
    scope: CapabilityScope,
    actor: CapabilityActor,
  ): Promise<CapabilitySummary>;
  getCapability(
    scope: CapabilityScope,
    actor: CapabilityActor,
    capabilityId: string,
  ): Promise<Capability>;
  createCapability(
    scope: CapabilityScope,
    actor: CapabilityActor,
    input: CreateCapabilityInput,
  ): Promise<Capability>;
  createVersion(
    scope: CapabilityScope,
    actor: CapabilityActor,
    capabilityId: string,
  ): Promise<Capability>;
  evaluateVersion(
    scope: CapabilityScope,
    actor: CapabilityActor,
    capabilityId: string,
    versionId: string,
  ): Promise<Capability>;
  publishVersion(
    scope: CapabilityScope,
    actor: CapabilityActor,
    capabilityId: string,
    versionId: string,
  ): Promise<Capability>;
  suspendVersion(
    scope: CapabilityScope,
    actor: CapabilityActor,
    capabilityId: string,
    versionId: string,
    reason: string,
  ): Promise<Capability>;
  resumeVersion(
    scope: CapabilityScope,
    actor: CapabilityActor,
    capabilityId: string,
    versionId: string,
  ): Promise<Capability>;
  deprecateVersion(
    scope: CapabilityScope,
    actor: CapabilityActor,
    capabilityId: string,
    versionId: string,
  ): Promise<Capability>;
  listPublishedOptions(
    scope: CapabilityScope,
    actor: CapabilityActor,
    taskType: CapabilityTaskType,
  ): Promise<CapabilitySelectionOption[]>;
  resolvePublishedVersion(
    scope: CapabilityScope,
    actor: CapabilityActor,
    versionId: string,
    taskType: CapabilityTaskType,
  ): Promise<CapabilitySelectionOption>;
}

export interface CreateCapabilityRepositoryOptions {
  storage?: CapabilityStorage;
  delay?: () => Promise<void>;
  now?: () => string;
}

interface CapabilityStoreEnvelope {
  schemaVersion: 1;
  nextCapabilitySequence: number;
  items: Capability[];
}

const canonicalScope: CapabilityScope = {
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
const releaseStatuses = new Set<CapabilityReleaseStatus>([
  "DRAFT",
  "VALIDATING",
  "IN_REVIEW",
  "PUBLISHED",
  "SUSPENDED",
  "DEPRECATED",
  "RETIRED",
]);
const taskTypes = new Set<CapabilityTaskType>([
  "GENERATE_TECHNICAL_DESIGN",
  "ANALYZE_REQUIREMENT",
  "CODE_REVIEW",
  "AUTOMATED_TEST",
]);

function defaultDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, DEFAULT_LATENCY_MS));
}

function getBrowserStorage(): CapabilityStorage {
  if (typeof window === "undefined") {
    throw new CapabilityRepositoryError(
      "INVALID_STORE",
      "能力中心仅可在浏览器模拟运行时中使用。",
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
    !Number.isNaN(Date.parse(value)) &&
    value.endsWith("Z")
  );
}

function validateScope(scope: CapabilityScope): void {
  if (
    scope.organizationId !== canonicalScope.organizationId ||
    scope.workspaceId !== canonicalScope.workspaceId
  ) {
    throw new CapabilityRepositoryError(
      "NOT_FOUND",
      "能力中心作用域不可用。",
    );
  }
}

function validateActor(actor: CapabilityActor): void {
  if (!validActorIds.has(actor.userId)) {
    throw new CapabilityRepositoryError(
      "FORBIDDEN",
      "能力中心操作身份不可用。",
    );
  }
}

function permissionFor(
  actor: CapabilityActor,
): CapabilityPermissionDecision {
  const canManage = managerActorIds.has(actor.userId);
  return {
    canRead: true,
    canUse: usableActorIds.has(actor.userId),
    canManage,
    canReviewAndPublish: canManage,
    reason: canManage
      ? "当前身份可构建、评测、审查和发布工作空间能力版本。"
      : actor.userId === "user-auditor"
        ? "审计员仅可查看能力版本、评测与状态迁移证据。"
        : "当前身份可发现并在任务中使用已发布能力，不能修改版本。",
  };
}

function requireManager(actor: CapabilityActor): void {
  if (!managerActorIds.has(actor.userId)) {
    throw new CapabilityRepositoryError(
      "FORBIDDEN",
      "只有能力构建器或工作空间管理员可执行此操作。",
    );
  }
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

function artifactDefaults(
  taskType: CapabilityTaskType,
): CreateCapabilityInput["artifactType"] {
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
}

function buildVersion(
  capabilityId: string,
  versionNumber: number,
  input: CreateCapabilityInput,
  actorId: string,
  timestamp: string,
  supersedesVersionId?: string,
): CapabilityVersion {
  const versionId = `${capabilityId}-v${versionNumber}`;
  const digest =
    capabilityId === "capability-technical-solution" && versionNumber === 1
      ? "sha256:capability-technical-solution-v1"
      : stableDigest(`${versionId}:${input.promptId}:${input.workflowId}`);
  return {
    id: versionId,
    versionNumber,
    status: "DRAFT",
    schemaVersion: 1,
    contentDigest: digest,
    skillDefinition: {
      name: input.code.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      taskTypes: [input.taskType],
      purpose: input.purpose,
      inputContract: "任务目标、范围、约束与完成标准",
      outputContract: input.artifactType,
      stepIntents: ["理解任务", "读取授权上下文", "生成结构化成果", "提交人工验收"],
      knownLimitations: ["不执行超出任务范围的动作", "不绕过人工审批与成果验收"],
      riskClassification: input.toolAction ? "R1" : "R0",
    },
    promptTemplateRef: {
      promptId: input.promptId,
      versionId: `${input.promptId}-v1`,
      versionNumber: 1,
      digest: stableDigest(`${input.promptId}-v1`),
      variableSchema: "task-capability-context-v1",
      outputSchema: `${input.artifactType.toLowerCase()}-v1`,
    },
    modelPolicy: {
      profile: input.modelProfile,
      dataResidency: "organization_policy",
      structuredOutputRequired: true,
      toolCallingRequired: Boolean(input.toolAction),
      fallbackAllowed: true,
      costCeiling: "workspace_policy",
    },
    knowledgeRequirements: input.includeKnowledge
      ? [
          {
            purpose: "software_engineering_tasks",
            classificationCeiling: "INTERNAL",
            scope: "CURRENT_WORKSPACE",
            effectiveRequired: true,
            citationRequired: true,
          },
        ]
      : [],
    toolRequirements: input.toolAction
      ? [
          {
            toolId: "tool-codegraph-read",
            toolVersionId: "tool-codegraph-read-v1",
            action: input.toolAction,
            riskLevel: "R0",
            required: true,
            targetDigest: "sha256:tool-codegraph-read-v1",
          },
        ]
      : [],
    workflowVersionRef: {
      workflowId: input.workflowId,
      versionId: `${input.workflowId}-v1`,
      versionNumber: 1,
      digest: stableDigest(`${input.workflowId}-v1`),
    },
    permissionRequirements: [
      { resource: "WORKSPACE", action: "READ", scope: "CURRENT_WORKSPACE" },
      ...(input.includeKnowledge
        ? [
            {
              resource: "KNOWLEDGE" as const,
              action: "READ" as const,
              scope: "CURRENT_WORKSPACE" as const,
            },
          ]
        : []),
      ...(input.toolAction
        ? [
            {
              resource: "TOOL" as const,
              action: "USE" as const,
              scope: "CURRENT_WORKSPACE" as const,
            },
          ]
        : []),
      {
        resource: "ARTIFACT",
        action: "CREATE_DRAFT",
        scope: "CURRENT_WORKSPACE",
      },
    ],
    artifactContract: {
      artifactType: input.artifactType,
      requiresReview: true,
      completionCriteriaMapping: [
        "结构满足成果结构规范",
        "内容覆盖任务完成标准",
        "授权知识必须生成引用",
      ],
    },
    evaluationGate: {
      sampleSetVersion: `${input.code.toLowerCase()}-samples-v1`,
      requiredResult: "PASSED",
      minimumRuns: 3,
      qualityThreshold: 0.85,
      safetyRequired: true,
      citationRequired: input.includeKnowledge,
      gateDigest: stableDigest(`${versionId}:evaluation-gate-v1`),
    },
    failurePolicy: {
      retryLimit: 2,
      missingKnowledge: "NEED_INPUT",
      permissionDenied: "STOP",
      unknownToolResult: "HUMAN_REVIEW",
      modelFailure: "BOUNDED_RETRY_THEN_HUMAN",
    },
    evaluationSummaries: [],
    ...(supersedesVersionId ? { supersedesVersionId } : {}),
    createdAt: timestamp,
    createdBy: actorId,
  };
}

function passEvaluation(
  version: CapabilityVersion,
  actorId: string,
  timestamp: string,
): EvaluationSummary {
  return {
    id: `${version.id}-evaluation-${version.evaluationSummaries.length + 1}`,
    result: "PASSED",
    sampleSetVersion: version.evaluationGate.sampleSetVersion,
    qualityScore: 0.93,
    safetyPassed: true,
    artifactContractPassed: true,
    permissionNegativePassed: true,
    evidenceReference: `mock://evaluation/${version.id}/summary`,
    evidenceDigest: stableDigest(`${version.contentDigest}:passed`),
    evaluatedAt: timestamp,
    evaluatedBy: actorId,
  };
}

function seedCapability(
  id: string,
  input: CreateCapabilityInput,
  status: CapabilityReleaseStatus,
  timestamp: string,
  options: { taskIds?: string[] } = {},
): Capability {
  const version = buildVersion(id, 1, input, "user-lead", timestamp);
  version.status = status;
  if (["IN_REVIEW", "PUBLISHED", "SUSPENDED", "DEPRECATED"].includes(status)) {
    version.evaluationSummaries = [
      passEvaluation(version, "mock-evaluation-worker", timestamp),
    ];
    version.reviewedAt = timestamp;
    version.reviewedBy = "user-lead";
  }
  if (["PUBLISHED", "SUSPENDED", "DEPRECATED"].includes(status)) {
    version.publishedAt = timestamp;
    version.publishedBy = "user-lead";
  }
  if (status === "SUSPENDED") {
    version.suspendedAt = timestamp;
    version.suspendedBy = "user-admin";
    version.suspensionReason = "必需工具健康检查失败，停止新任务解析。";
  }
  if (status === "DEPRECATED") {
    version.deprecatedAt = timestamp;
    version.deprecatedBy = "user-lead";
  }
  return {
    id,
    scope: cloneMutable(canonicalScope),
    code: input.code,
    name: input.name,
    purpose: input.purpose,
    ownerId: input.ownerId,
    status: "ACTIVE",
    ...(status === "PUBLISHED" ? { publishedVersionId: version.id } : {}),
    versions: [version],
    referencedTaskIds: options.taskIds ?? [],
    aggregateVersion: 1,
    createdAt: timestamp,
    createdBy: "user-lead",
    updatedAt: timestamp,
    updatedBy: "user-lead",
  };
}

function defaultEnvelope(): CapabilityStoreEnvelope {
  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    nextCapabilitySequence: 5,
    items: [
      seedCapability(
        "capability-technical-solution",
        {
          code: "TECHNICAL_SOLUTION",
          name: "技术方案生成",
          purpose: "根据任务目标、约束和授权知识生成可验收的技术方案成果。",
          ownerId: "user-lead",
          taskType: "GENERATE_TECHNICAL_DESIGN",
          promptId: "prompt-technical-solution",
          modelProfile: "reasoning-structured-output",
          workflowId: "workflow-technical-solution",
          artifactType: "TECHNICAL_DESIGN",
          includeKnowledge: true,
          toolAction: "codegraph.context",
        },
        "PUBLISHED",
        "2026-07-25T09:30:00.000Z",
        { taskIds: ["task-golden-technical-solution"] },
      ),
      seedCapability(
        "capability-requirement-analysis",
        {
          code: "REQUIREMENT_ANALYSIS",
          name: "需求分析",
          purpose: "把业务问题整理为范围、约束、验收标准与澄清项。",
          ownerId: "user-pm",
          taskType: "ANALYZE_REQUIREMENT",
          promptId: "prompt-requirement-analysis",
          modelProfile: "analysis-structured-output",
          workflowId: "workflow-requirement-analysis",
          artifactType: "REQUIREMENT_ANALYSIS",
          includeKnowledge: true,
        },
        "PUBLISHED",
        "2026-07-21T08:00:00.000Z",
      ),
      seedCapability(
        "capability-code-review",
        {
          code: "CODE_REVIEW",
          name: "代码审查",
          purpose: "对授权代码范围进行只读审查并输出问题与验证证据。",
          ownerId: "user-lead",
          taskType: "CODE_REVIEW",
          promptId: "prompt-code-review",
          modelProfile: "code-review-structured-output",
          workflowId: "workflow-code-review",
          artifactType: "CODE_REVIEW_REPORT",
          includeKnowledge: true,
          toolAction: "codegraph.context",
        },
        "SUSPENDED",
        "2026-07-24T12:00:00.000Z",
      ),
      seedCapability(
        "capability-automated-test",
        {
          code: "AUTOMATED_TEST",
          name: "自动测试设计",
          purpose: "根据验收标准生成受控测试方案与测试报告草稿。",
          ownerId: "user-dev",
          taskType: "AUTOMATED_TEST",
          promptId: "prompt-automated-test",
          modelProfile: "test-design-structured-output",
          workflowId: "workflow-automated-test",
          artifactType: "TEST_REPORT",
          includeKnowledge: false,
        },
        "DRAFT",
        "2026-07-25T13:30:00.000Z",
      ),
    ],
  };
}

function isCapabilityEnvelope(value: unknown): value is CapabilityStoreEnvelope {
  if (
    !isRecord(value) ||
    value.schemaVersion !== STORE_SCHEMA_VERSION ||
    !Number.isSafeInteger(value.nextCapabilitySequence) ||
    !Array.isArray(value.items)
  ) {
    return false;
  }
  return value.items.every(
    (item) =>
      isRecord(item) &&
      isNonEmptyString(item.id) &&
      isNonEmptyString(item.code) &&
      isNonEmptyString(item.name) &&
      isNonEmptyString(item.purpose) &&
      Array.isArray(item.versions) &&
      item.versions.length > 0 &&
      item.versions.every(
        (version) =>
          isRecord(version) &&
          isNonEmptyString(version.id) &&
          releaseStatuses.has(version.status as CapabilityReleaseStatus) &&
          isNonEmptyString(version.contentDigest) &&
          isIsoTimestamp(version.createdAt),
      ),
  );
}

function validateInput(input: CreateCapabilityInput): void {
  if (
    !isNonEmptyString(input.code) ||
    !/^[A-Z][A-Z0-9_]{2,63}$/.test(input.code) ||
    !isNonEmptyString(input.name) ||
    !isNonEmptyString(input.purpose) ||
    !validActorIds.has(input.ownerId) ||
    !taskTypes.has(input.taskType) ||
    !isNonEmptyString(input.promptId) ||
    !isNonEmptyString(input.modelProfile) ||
    !isNonEmptyString(input.workflowId) ||
    input.artifactType !== artifactDefaults(input.taskType) ||
    (input.toolAction !== undefined && !isNonEmptyString(input.toolAction))
  ) {
    throw new CapabilityRepositoryError(
      "VALIDATION",
      "能力配置不完整，或任务类型与成果契约不匹配。",
    );
  }
}

function latestVersion(capability: Capability): CapabilityVersion {
  return capability.versions.reduce((latest, version) =>
    version.versionNumber > latest.versionNumber ? version : latest,
  );
}

function toListItem(capability: Capability): CapabilityListItem {
  const current =
    capability.versions.find(({ id }) => id === capability.publishedVersionId) ??
    latestVersion(capability);
  const evaluation = current.evaluationSummaries.at(-1);
  return {
    id: capability.id,
    code: capability.code,
    name: capability.name,
    purpose: capability.purpose,
    ownerId: capability.ownerId,
    taskTypes: cloneMutable(current.skillDefinition.taskTypes),
    rootStatus: capability.status,
    releaseStatus: current.status,
    currentVersionId: current.id,
    currentVersionNumber: current.versionNumber,
    ...(capability.publishedVersionId
      ? { publishedVersionId: capability.publishedVersionId }
      : {}),
    ...(evaluation ? { evaluationResult: evaluation.result } : {}),
    dependencyCount:
      current.knowledgeRequirements.length +
      current.toolRequirements.length +
      2,
    taskUsageCount: capability.referencedTaskIds.length,
    updatedAt: capability.updatedAt,
  };
}

function optionFrom(
  capability: Capability,
  version: CapabilityVersion,
): CapabilitySelectionOption {
  return {
    capabilityId: capability.id,
    capabilityName: capability.name,
    purpose: capability.purpose,
    taskType: version.skillDefinition.taskTypes[0],
    versionRef: toCapabilityVersionRef(capability, version),
    modelProfile: version.modelPolicy.profile,
    workflowVersionId: version.workflowVersionRef.versionId,
    knowledgeRequired: version.knowledgeRequirements.some(
      ({ effectiveRequired }) => effectiveRequired,
    ),
    toolActions: version.toolRequirements.map(({ action }) => action),
  };
}

export function createCapabilityRepository(
  options: CreateCapabilityRepositoryOptions = {},
): CapabilityRepository {
  const storage = options.storage ?? getBrowserStorage();
  const delay = options.delay ?? defaultDelay;
  const now = options.now ?? (() => new Date().toISOString());

  async function prepare(scope: CapabilityScope, actor: CapabilityActor) {
    await delay();
    validateScope(scope);
    validateActor(actor);
  }

  function readEnvelope(): CapabilityStoreEnvelope {
    let raw: string | null;
    try {
      raw = storage.getItem(CAPABILITY_STORE_KEY);
    } catch {
      throw new CapabilityRepositoryError(
        "INVALID_STORE",
        "能力中心数据不可用。",
      );
    }
    if (raw === null) {
      return defaultEnvelope();
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isCapabilityEnvelope(parsed)) {
        throw new Error("invalid");
      }
      return parsed;
    } catch {
      try {
        storage.removeItem(CAPABILITY_STORE_KEY);
      } catch {
        // 即使清理受阻，也必须保持默认拒绝。
      }
      throw new CapabilityRepositoryError(
        "INVALID_STORE",
        "能力中心本地数据未通过完整性校验，已拒绝加载。",
      );
    }
  }

  function writeEnvelope(envelope: CapabilityStoreEnvelope): void {
    if (!isCapabilityEnvelope(envelope)) {
      throw new CapabilityRepositoryError(
        "INVALID_STORE",
        "能力中心写入未通过完整性校验。",
      );
    }
    storage.setItem(CAPABILITY_STORE_KEY, JSON.stringify(envelope));
  }

  function findMutable(
    envelope: CapabilityStoreEnvelope,
    capabilityId: string,
  ): Capability {
    const capability = envelope.items.find(({ id }) => id === capabilityId);
    if (!capability || capability.scope.workspaceId !== canonicalScope.workspaceId) {
      throw new CapabilityRepositoryError(
        "NOT_FOUND",
        "能力在当前工作空间中不可用。",
      );
    }
    return capability;
  }

  function mutate(
    envelope: CapabilityStoreEnvelope,
    capability: Capability,
    actor: CapabilityActor,
    timestamp: string,
  ): Capability {
    capability.aggregateVersion += 1;
    capability.updatedAt = timestamp;
    capability.updatedBy = actor.userId;
    writeEnvelope(envelope);
    return cloneMutable(capability);
  }

  return {
    async getPermission(scope, actor) {
      await prepare(scope, actor);
      return cloneMutable(permissionFor(actor));
    },

    async listCapabilities(scope, actor, query = {}) {
      await prepare(scope, actor);
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
      const keyword = query.keyword?.trim().toLocaleLowerCase();
      const items = readEnvelope()
        .items.map(toListItem)
        .filter(
          (item) =>
            (!keyword ||
              `${item.name}${item.code}${item.purpose}`
                .toLocaleLowerCase()
                .includes(keyword)) &&
            (!query.releaseStatus ||
              item.releaseStatus === query.releaseStatus) &&
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
        published: items.filter(({ releaseStatus }) => releaseStatus === "PUBLISHED")
          .length,
        inGovernance: items.filter(({ releaseStatus }) =>
          ["DRAFT", "VALIDATING", "IN_REVIEW"].includes(releaseStatus),
        ).length,
        attention: items.filter(({ releaseStatus }) =>
          ["SUSPENDED", "DEPRECATED", "RETIRED"].includes(releaseStatus),
        ).length,
      };
    },

    async getCapability(scope, actor, capabilityId) {
      await prepare(scope, actor);
      return cloneMutable(findMutable(readEnvelope(), capabilityId));
    },

    async createCapability(scope, actor, input) {
      await prepare(scope, actor);
      requireManager(actor);
      validateInput(input);
      const envelope = readEnvelope();
      if (
        envelope.items.some(
          ({ code }) => code.toLocaleLowerCase() === input.code.toLocaleLowerCase(),
        )
      ) {
        throw new CapabilityRepositoryError(
          "CONFLICT",
          "能力编码在当前工作空间中必须唯一。",
        );
      }
      const sequence = envelope.nextCapabilitySequence;
      const id = `capability-custom-${String(sequence).padStart(3, "0")}`;
      const timestamp = now();
      const version = buildVersion(id, 1, input, actor.userId, timestamp);
      const capability: Capability = {
        id,
        scope: cloneMutable(canonicalScope),
        code: input.code,
        name: input.name.trim(),
        purpose: input.purpose.trim(),
        ownerId: input.ownerId,
        status: "ACTIVE",
        versions: [version],
        referencedTaskIds: [],
        aggregateVersion: 1,
        createdAt: timestamp,
        createdBy: actor.userId,
        updatedAt: timestamp,
        updatedBy: actor.userId,
      };
      envelope.items.push(capability);
      envelope.nextCapabilitySequence += 1;
      writeEnvelope(envelope);
      return cloneMutable(capability);
    },

    async createVersion(scope, actor, capabilityId) {
      await prepare(scope, actor);
      requireManager(actor);
      const envelope = readEnvelope();
      const capability = findMutable(envelope, capabilityId);
      if (latestVersion(capability).status === "DRAFT") {
        throw new CapabilityRepositoryError(
          "CONFLICT",
          "已有草稿版本，请先完成该版本治理。",
        );
      }
      const source = latestVersion(capability);
      const input: CreateCapabilityInput = {
        code: capability.code,
        name: capability.name,
        purpose: capability.purpose,
        ownerId: capability.ownerId,
        taskType: source.skillDefinition.taskTypes[0],
        promptId: source.promptTemplateRef.promptId,
        modelProfile: source.modelPolicy.profile,
        workflowId: source.workflowVersionRef.workflowId,
        artifactType: source.artifactContract.artifactType,
        includeKnowledge: source.knowledgeRequirements.length > 0,
        ...(source.toolRequirements[0]
          ? { toolAction: source.toolRequirements[0].action }
          : {}),
      };
      const timestamp = now();
      capability.versions.push(
        buildVersion(
          capability.id,
          source.versionNumber + 1,
          input,
          actor.userId,
          timestamp,
          source.id,
        ),
      );
      return mutate(envelope, capability, actor, timestamp);
    },

    async evaluateVersion(scope, actor, capabilityId, versionId) {
      await prepare(scope, actor);
      requireManager(actor);
      const envelope = readEnvelope();
      const capability = findMutable(envelope, capabilityId);
      const version = capability.versions.find(({ id }) => id === versionId);
      if (!version) {
        throw new CapabilityRepositoryError("NOT_FOUND", "能力版本不存在。");
      }
      if (version.status !== "DRAFT") {
        throw new CapabilityRepositoryError(
          "CONFLICT",
          "只有草稿版本可提交确定性模拟评测。",
        );
      }
      const timestamp = now();
      version.status = "VALIDATING";
      version.evaluationSummaries.push(
        passEvaluation(version, "mock-evaluation-worker", timestamp),
      );
      version.status = "IN_REVIEW";
      version.reviewedAt = timestamp;
      version.reviewedBy = actor.userId;
      return mutate(envelope, capability, actor, timestamp);
    },

    async publishVersion(scope, actor, capabilityId, versionId) {
      await prepare(scope, actor);
      requireManager(actor);
      const envelope = readEnvelope();
      const capability = findMutable(envelope, capabilityId);
      const version = capability.versions.find(({ id }) => id === versionId);
      if (!version) {
        throw new CapabilityRepositoryError("NOT_FOUND", "能力版本不存在。");
      }
      const evaluation = version.evaluationSummaries.at(-1);
      if (
        version.status !== "IN_REVIEW" ||
        evaluation?.result !== "PASSED" ||
        !evaluation.safetyPassed ||
        !evaluation.artifactContractPassed ||
        !evaluation.permissionNegativePassed
      ) {
        throw new CapabilityRepositoryError(
          "CAPABILITY_NOT_PUBLISHABLE",
          "评测、安全、成果契约与人工审查门禁必须全部通过。",
        );
      }
      const timestamp = now();
      const previous = capability.versions.find(
        ({ id }) => id === capability.publishedVersionId,
      );
      if (previous && previous.id !== version.id) {
        previous.status = "DEPRECATED";
        previous.deprecatedAt = timestamp;
        previous.deprecatedBy = actor.userId;
      }
      version.status = "PUBLISHED";
      version.publishedAt = timestamp;
      version.publishedBy = actor.userId;
      capability.publishedVersionId = version.id;
      return mutate(envelope, capability, actor, timestamp);
    },

    async suspendVersion(scope, actor, capabilityId, versionId, reason) {
      await prepare(scope, actor);
      requireManager(actor);
      if (!isNonEmptyString(reason)) {
        throw new CapabilityRepositoryError(
          "VALIDATION",
          "暂停原因不能为空。",
        );
      }
      const envelope = readEnvelope();
      const capability = findMutable(envelope, capabilityId);
      const version = capability.versions.find(({ id }) => id === versionId);
      if (!version || version.status !== "PUBLISHED") {
        throw new CapabilityRepositoryError(
          "CONFLICT",
          "只有已发布版本可以暂停。",
        );
      }
      const timestamp = now();
      version.status = "SUSPENDED";
      version.suspendedAt = timestamp;
      version.suspendedBy = actor.userId;
      version.suspensionReason = reason.trim();
      if (capability.publishedVersionId === version.id) {
        delete capability.publishedVersionId;
      }
      return mutate(envelope, capability, actor, timestamp);
    },

    async resumeVersion(scope, actor, capabilityId, versionId) {
      await prepare(scope, actor);
      requireManager(actor);
      const envelope = readEnvelope();
      const capability = findMutable(envelope, capabilityId);
      const version = capability.versions.find(({ id }) => id === versionId);
      if (!version || version.status !== "SUSPENDED") {
        throw new CapabilityRepositoryError(
          "CONFLICT",
          "只有已暂停版本可在依赖复核后恢复。",
        );
      }
      const timestamp = now();
      version.status = "PUBLISHED";
      delete version.suspendedAt;
      delete version.suspendedBy;
      delete version.suspensionReason;
      capability.publishedVersionId = version.id;
      return mutate(envelope, capability, actor, timestamp);
    },

    async deprecateVersion(scope, actor, capabilityId, versionId) {
      await prepare(scope, actor);
      requireManager(actor);
      const envelope = readEnvelope();
      const capability = findMutable(envelope, capabilityId);
      const version = capability.versions.find(({ id }) => id === versionId);
      if (!version || version.status !== "PUBLISHED") {
        throw new CapabilityRepositoryError(
          "CONFLICT",
          "只有已发布版本可进入已弃用。",
        );
      }
      const timestamp = now();
      version.status = "DEPRECATED";
      version.deprecatedAt = timestamp;
      version.deprecatedBy = actor.userId;
      if (capability.publishedVersionId === version.id) {
        delete capability.publishedVersionId;
      }
      return mutate(envelope, capability, actor, timestamp);
    },

    async listPublishedOptions(scope, actor, taskType) {
      await prepare(scope, actor);
      if (!usableActorIds.has(actor.userId)) {
        return [];
      }
      return readEnvelope()
        .items.flatMap((capability) =>
          capability.versions
            .filter(
              (version) =>
                version.status === "PUBLISHED" &&
                version.id === capability.publishedVersionId &&
                version.skillDefinition.taskTypes.includes(taskType),
            )
            .map((version) => optionFrom(capability, version)),
        )
        .sort((left, right) =>
          left.capabilityName.localeCompare(right.capabilityName, "zh-CN"),
        );
    },

    async resolvePublishedVersion(scope, actor, versionId, taskType) {
      const options = await this.listPublishedOptions(scope, actor, taskType);
      const option = options.find(
        ({ versionRef }) => versionRef.versionId === versionId,
      );
      if (!option) {
        throw new CapabilityRepositoryError(
          "NOT_FOUND",
          "能力版本未发布、已暂停、任务类型不匹配或当前身份无权使用。",
        );
      }
      return cloneMutable(option);
    },
  };
}

function repository(): CapabilityRepository {
  return createCapabilityRepository();
}

export const getCapabilityPermission = (
  scope: CapabilityScope,
  actor: CapabilityActor,
) => repository().getPermission(scope, actor);

export const listCapabilities = (
  scope: CapabilityScope,
  actor: CapabilityActor,
  query: CapabilityQuery = {},
) => repository().listCapabilities(scope, actor, query);

export const getCapabilitySummary = (
  scope: CapabilityScope,
  actor: CapabilityActor,
) => repository().getSummary(scope, actor);

export const getCapability = (
  scope: CapabilityScope,
  actor: CapabilityActor,
  capabilityId: string,
) => repository().getCapability(scope, actor, capabilityId);

export const createCapability = (
  scope: CapabilityScope,
  actor: CapabilityActor,
  input: CreateCapabilityInput,
) => repository().createCapability(scope, actor, input);

export const createCapabilityVersion = (
  scope: CapabilityScope,
  actor: CapabilityActor,
  capabilityId: string,
) => repository().createVersion(scope, actor, capabilityId);

export const evaluateCapabilityVersion = (
  scope: CapabilityScope,
  actor: CapabilityActor,
  capabilityId: string,
  versionId: string,
) => repository().evaluateVersion(scope, actor, capabilityId, versionId);

export const publishCapabilityVersion = (
  scope: CapabilityScope,
  actor: CapabilityActor,
  capabilityId: string,
  versionId: string,
) => repository().publishVersion(scope, actor, capabilityId, versionId);

export const suspendCapabilityVersion = (
  scope: CapabilityScope,
  actor: CapabilityActor,
  capabilityId: string,
  versionId: string,
  reason: string,
) =>
  repository().suspendVersion(
    scope,
    actor,
    capabilityId,
    versionId,
    reason,
  );

export const resumeCapabilityVersion = (
  scope: CapabilityScope,
  actor: CapabilityActor,
  capabilityId: string,
  versionId: string,
) => repository().resumeVersion(scope, actor, capabilityId, versionId);

export const deprecateCapabilityVersion = (
  scope: CapabilityScope,
  actor: CapabilityActor,
  capabilityId: string,
  versionId: string,
) => repository().deprecateVersion(scope, actor, capabilityId, versionId);

export const listPublishedCapabilityOptions = (
  scope: CapabilityScope,
  actor: CapabilityActor,
  taskType: CapabilityTaskType,
) => repository().listPublishedOptions(scope, actor, taskType);

export const resolvePublishedCapabilityVersion = (
  scope: CapabilityScope,
  actor: CapabilityActor,
  versionId: string,
  taskType: CapabilityTaskType,
) => repository().resolvePublishedVersion(scope, actor, versionId, taskType);
