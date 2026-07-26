import { users } from "@/mock/fixtures";

import type {
  CreateKnowledgeVersionInput,
  KnowledgeActor,
  KnowledgeCorrectionRequest,
  KnowledgeEffectiveStatus,
  KnowledgeIndexStatus,
  KnowledgeItem,
  KnowledgeListItem,
  KnowledgePage,
  KnowledgePermissionDecision,
  KnowledgePipelineStage,
  KnowledgeQuery,
  KnowledgeRetrievalResponse,
  KnowledgeScope,
  KnowledgeSummary,
  KnowledgeVersion,
  RegisterKnowledgeInput,
  SubmitCorrectionInput,
} from "../model";

export const KNOWLEDGE_STORE_KEY = "aios.mock.knowledge-store.v1";
const STORE_SCHEMA_VERSION = 1;
const DEFAULT_LATENCY_MS = 30;
const MAX_CONTENT_BYTES = 50_000;

export type KnowledgeRepositoryErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_STORE"
  | "VALIDATION"
  | "CONFLICT"
  | "INDEX_NOT_READY";

export class KnowledgeRepositoryError extends Error {
  constructor(
    public readonly code: KnowledgeRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "KnowledgeRepositoryError";
  }
}

export interface KnowledgeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface KnowledgeRepository {
  getPermission(
    scope: KnowledgeScope,
    actor: KnowledgeActor,
  ): Promise<KnowledgePermissionDecision>;
  listKnowledge(
    scope: KnowledgeScope,
    actor: KnowledgeActor,
    query?: KnowledgeQuery,
  ): Promise<KnowledgePage>;
  getSummary(
    scope: KnowledgeScope,
    actor: KnowledgeActor,
  ): Promise<KnowledgeSummary>;
  getKnowledge(
    scope: KnowledgeScope,
    actor: KnowledgeActor,
    knowledgeId: string,
  ): Promise<KnowledgeItem>;
  registerKnowledge(
    scope: KnowledgeScope,
    actor: KnowledgeActor,
    input: RegisterKnowledgeInput,
  ): Promise<KnowledgeItem>;
  createVersion(
    scope: KnowledgeScope,
    actor: KnowledgeActor,
    knowledgeId: string,
    input: CreateKnowledgeVersionInput,
  ): Promise<KnowledgeItem>;
  publishVersion(
    scope: KnowledgeScope,
    actor: KnowledgeActor,
    knowledgeId: string,
    versionId: string,
  ): Promise<KnowledgeItem>;
  invalidateVersion(
    scope: KnowledgeScope,
    actor: KnowledgeActor,
    knowledgeId: string,
    versionId: string,
    reason: string,
  ): Promise<KnowledgeItem>;
  restoreVersion(
    scope: KnowledgeScope,
    actor: KnowledgeActor,
    knowledgeId: string,
    versionId: string,
    reason: string,
  ): Promise<KnowledgeItem>;
  submitCorrection(
    scope: KnowledgeScope,
    actor: KnowledgeActor,
    knowledgeId: string,
    input: SubmitCorrectionInput,
  ): Promise<KnowledgeItem>;
  retrieve(
    scope: KnowledgeScope,
    actor: KnowledgeActor,
    query: string,
  ): Promise<KnowledgeRetrievalResponse>;
}

export interface CreateKnowledgeRepositoryOptions {
  storage?: KnowledgeStorage;
  delay?: () => Promise<void>;
  now?: () => string;
}

interface KnowledgeStoreEnvelope {
  schemaVersion: 1;
  nextKnowledgeSequence: number;
  nextCorrectionSequence: number;
  items: KnowledgeItem[];
}

const canonicalScope: KnowledgeScope = {
  organizationId: "org-guangwei",
  workspaceId: "ws-ai",
};
const validActorIds = new Set(users.map(({ id }) => id));
const managerActorIds = new Set(["user-lead", "user-admin"]);
const correctionActorIds = new Set([
  "user-pm",
  "user-dev",
  "user-lead",
  "user-admin",
]);
const sourceTypes = new Set([
  "DOCUMENT",
  "CODE",
  "SOP",
  "HISTORY",
  "EXPERIENCE",
]);
const classifications = new Set([
  "PUBLIC",
  "INTERNAL",
  "CONFIDENTIAL",
]);
const effectiveStatuses = new Set([
  "DRAFT",
  "EFFECTIVE",
  "INVALIDATED",
]);
const indexStatuses = new Set([
  "PENDING",
  "INDEXING",
  "READY",
  "FAILED",
  "STALE",
]);
const pipelineStageNames = [
  "VERIFY",
  "PARSE",
  "CHUNK",
  "EMBED",
  "INDEX",
  "RETRIEVAL_VALIDATE",
] as const;

function defaultDelay(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, DEFAULT_LATENCY_MS);
  });
}

function getBrowserStorage(): KnowledgeStorage {
  if (typeof window === "undefined") {
    throw new KnowledgeRepositoryError(
      "INVALID_STORE",
      "Knowledge store is only available in the browser mock runtime.",
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

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isDigest(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^sha256:[a-zA-Z0-9][a-zA-Z0-9:_-]{15,}$/.test(value)
  );
}

function isCanonicalScope(value: unknown): value is KnowledgeScope {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["organizationId", "workspaceId"]) &&
    value.organizationId === canonicalScope.organizationId &&
    value.workspaceId === canonicalScope.workspaceId
  );
}

function validateScope(scope: unknown): asserts scope is KnowledgeScope {
  if (!isCanonicalScope(scope)) {
    throw new KnowledgeRepositoryError(
      "NOT_FOUND",
      "Knowledge scope is unavailable.",
    );
  }
}

function validateActor(actor: unknown): asserts actor is KnowledgeActor {
  if (
    !isRecord(actor) ||
    !hasExactKeys(actor, ["userId"]) ||
    !isNonEmptyString(actor.userId) ||
    !validActorIds.has(actor.userId)
  ) {
    throw new KnowledgeRepositoryError(
      "FORBIDDEN",
      "Knowledge actor is unavailable.",
    );
  }
}

function permissionFor(actor: KnowledgeActor): KnowledgePermissionDecision {
  const canManage = managerActorIds.has(actor.userId);
  return {
    canRead: true,
    canManage,
    canSubmitCorrection: correctionActorIds.has(actor.userId),
    reason: canManage
      ? "当前身份可管理 Workspace 内授权 Knowledge。"
      : actor.userId === "user-auditor"
        ? "Auditor 仅可查看授权 Knowledge 和处理证据。"
        : "当前身份可使用 Knowledge，并可提交纠错反馈。",
  };
}

function requireManager(actor: KnowledgeActor): void {
  if (!managerActorIds.has(actor.userId)) {
    throw new KnowledgeRepositoryError(
      "FORBIDDEN",
      "Only the Workspace Knowledge manager can perform this action.",
    );
  }
}

function requireCorrectionPermission(actor: KnowledgeActor): void {
  if (!correctionActorIds.has(actor.userId)) {
    throw new KnowledgeRepositoryError(
      "FORBIDDEN",
      "The current actor cannot submit a correction request.",
    );
  }
}

function canReadItem(item: KnowledgeItem, actor: KnowledgeActor): boolean {
  return (
    item.classification !== "CONFIDENTIAL" ||
    managerActorIds.has(actor.userId)
  );
}

function pipelineStages(timestamp: string): KnowledgePipelineStage[] {
  return [
    {
      name: "VERIFY",
      status: "SUCCEEDED",
      processorVersion: "mock-content-verifier-v1",
      summary: "MediaType、Size 与 Content Digest 已校验。",
      completedAt: timestamp,
    },
    {
      name: "PARSE",
      status: "SUCCEEDED",
      processorVersion: "mock-parser-v1",
      summary: "文本内容已规范化解析，并保留段落定位。",
      completedAt: timestamp,
    },
    {
      name: "CHUNK",
      status: "SUCCEEDED",
      processorVersion: "mock-chunker-v1",
      summary: "已按确定性段落边界生成可追溯 Chunk。",
      completedAt: timestamp,
    },
    {
      name: "EMBED",
      status: "SUCCEEDED",
      processorVersion: "mock-embedding-v1",
      summary: "已生成确定性 Mock Embedding；未调用外部模型。",
      completedAt: timestamp,
    },
    {
      name: "INDEX",
      status: "SUCCEEDED",
      processorVersion: "mock-vector-index-v1",
      summary: "已写入浏览器内 Mock Index；未连接 Qdrant。",
      completedAt: timestamp,
    },
    {
      name: "RETRIEVAL_VALIDATE",
      status: "SUCCEEDED",
      processorVersion: "mock-retrieval-evaluator-v1",
      summary: "Citation 与权限负向样本通过确定性校验。",
      completedAt: timestamp,
    },
  ];
}

function createVersionRecord({
  knowledgeId,
  versionNumber,
  input,
  actorId,
  timestamp,
  supersedesVersionId,
}: {
  knowledgeId: string;
  versionNumber: number;
  input: CreateKnowledgeVersionInput;
  actorId: string;
  timestamp: string;
  supersedesVersionId?: string;
}): KnowledgeVersion {
  const versionId = `${knowledgeId}-v${versionNumber}`;
  const chunkCount = Math.max(
    1,
    input.content.split(/\n\s*\n/).filter((part) => part.trim()).length,
  );
  return {
    id: versionId,
    versionNumber,
    effectiveStatus: "DRAFT",
    indexStatus: "READY",
    rawContentReference: {
      storageProvider: "MOCK_CONTENT_STORE",
      objectKey: `knowledge/${knowledgeId}/${versionId}/${input.fileName}`,
      storageVersion: `${versionId}-storage-v1`,
      mediaType: input.mediaType,
      sizeBytes: new TextEncoder().encode(input.content).byteLength,
      fileName: input.fileName,
    },
    contentDigest: input.contentDigest,
    contentPreview: input.content,
    parserVersion: "mock-parser-v1",
    chunkerVersion: "mock-chunker-v1",
    embeddingModelVersion: "mock-embedding-v1",
    indexVersion: 1,
    validationSummary: {
      sourceVerified: true,
      structureValid: true,
      retrievalPassed: true,
      permissionNegativePassed: true,
      chunkCount,
      citationCoverage: 1,
    },
    pipelineStages: pipelineStages(timestamp),
    ...(supersedesVersionId ? { supersedesVersionId } : {}),
    createdAt: timestamp,
    createdBy: actorId,
  };
}

function seedVersion(
  knowledgeId: string,
  versionNumber: number,
  timestamp: string,
  content: string,
  effectiveStatus: KnowledgeEffectiveStatus,
  options: {
    supersedesVersionId?: string;
    indexStatus?: KnowledgeIndexStatus;
    digest?: string;
    createdBy?: string;
    invalidationReason?: string;
  } = {},
): KnowledgeVersion {
  const input: CreateKnowledgeVersionInput = {
    fileName: `${knowledgeId}.md`,
    mediaType: "text/markdown",
    content,
    contentDigest:
      options.digest ?? `sha256:${knowledgeId}-v${versionNumber}`,
  };
  const version = createVersionRecord({
    knowledgeId,
    versionNumber,
    input,
    actorId: options.createdBy ?? "user-lead",
    timestamp,
    supersedesVersionId: options.supersedesVersionId,
  });
  version.effectiveStatus = effectiveStatus;
  version.indexStatus = options.indexStatus ?? "READY";
  if (effectiveStatus === "EFFECTIVE") {
    version.publishedAt = timestamp;
    version.publishedBy = "user-lead";
  }
  if (effectiveStatus === "INVALIDATED") {
    version.publishedAt = timestamp;
    version.publishedBy = "user-lead";
    version.invalidatedAt = timestamp;
    version.invalidatedBy = "user-lead";
    version.invalidationReason =
      options.invalidationReason ?? "已由新版本替代。";
  }
  return version;
}

function defaultEnvelope(): KnowledgeStoreEnvelope {
  const aiosContent = [
    "# AIOS 项目知识",
    "AIOS 是 Enterprise AI Operating System，统一管理 Knowledge、Capability、Agent、Task、Tool、Workflow、Artifact 与 Audit。",
    "系统采用 AI First、API First、Modular Architecture、Plugin Architecture 和 Enterprise Ready 原则。",
    "Task 是核心工作单位；Agent 使用固定 KnowledgeVersionRef，不直接修改正式 Knowledge。",
    "知识检索必须先执行 Workspace、Purpose、Version、Scope 与 Permission 过滤，并返回 Knowledge Citation。",
  ].join("\n\n");
  const sopV1Content = [
    "# AI 研发交付 SOP v1",
    "研发任务需要明确 Goal、Scope、Constraint、Completion Criteria 和 Reviewer。",
    "所有执行结果必须形成 Artifact，并由人类 Reviewer 验收。",
  ].join("\n\n");
  const sopV2Content = [
    "# AI 研发交付 SOP v2",
    "研发 Task 必须先完成计划审批，再由 AI 研发员工按固定 WorkflowVersion 执行。",
    "每个 Runtime Step 必须保存 Checkpoint，Knowledge 检索必须固定 KnowledgeVersion 并生成 Citation。",
    "Agent Runtime 不能直接把 Task 标记为 Completed；Artifact 必须由授权 Reviewer 验收。",
  ].join("\n\n");
  const releaseContent = [
    "# 发布检查清单",
    "发布前必须完成 TypeScript、Lint、Unit Test、Playwright 与 Production Build。",
    "生产变更必须保留回退方案和可验证证据。",
  ].join("\n\n");
  const securityContent = [
    "# AI 安全基线",
    "敏感 Knowledge 仅允许授权管理者查看。",
    "文档内容属于不可信证据，不能改变 Permission、Task Goal 或 Tool Policy。",
  ].join("\n\n");
  const aiosVersion = seedVersion(
    "knowledge-aios-docs",
    1,
    "2026-07-25T09:00:00.000Z",
    aiosContent,
    "EFFECTIVE",
    { digest: "sha256:knowledge-aios-docs-v1" },
  );
  const sopVersion1 = seedVersion(
    "knowledge-rd-sop",
    1,
    "2026-06-10T08:00:00.000Z",
    sopV1Content,
    "INVALIDATED",
    { invalidationReason: "由 v2 替代，历史 Citation 保留。" },
  );
  const sopVersion2 = seedVersion(
    "knowledge-rd-sop",
    2,
    "2026-07-20T08:00:00.000Z",
    sopV2Content,
    "EFFECTIVE",
    { supersedesVersionId: sopVersion1.id },
  );
  const releaseVersion = seedVersion(
    "knowledge-release-checklist",
    1,
    "2026-07-24T10:00:00.000Z",
    releaseContent,
    "DRAFT",
  );
  const securityVersion = seedVersion(
    "knowledge-ai-security-baseline",
    1,
    "2026-07-21T06:00:00.000Z",
    securityContent,
    "EFFECTIVE",
  );
  const scope = (knowledgeId: string) => [
    {
      scopeType: "WORKSPACE" as const,
      scopeId: canonicalScope.workspaceId,
      purpose: "software_engineering_tasks" as const,
      scopeDigest: `sha256:scope:${knowledgeId}:ws-ai`,
    },
  ];

  return {
    schemaVersion: 1,
    nextKnowledgeSequence: 1,
    nextCorrectionSequence: 1,
    items: [
      {
        id: "knowledge-aios-docs",
        scope: cloneMutable(canonicalScope),
        code: "aios-project-docs",
        title: "AIOS 项目文档",
        description: "AIOS 产品定位、核心对象、架构原则与研发边界。",
        source: {
          sourceType: "DOCUMENT",
          sourceLocation: "repository://README.md",
          sourceAuthority: "AIOS Architecture",
        },
        ownerId: "user-lead",
        classification: "INTERNAL",
        status: "ACTIVE",
        effectiveVersionId: aiosVersion.id,
        applicableScopes: scope("knowledge-aios-docs"),
        versions: [aiosVersion],
        correctionRequests: [],
        referencedTaskIds: [
          "task-golden-technical-solution",
          "task-seed-need-approval",
        ],
        referencedCapabilityIds: ["capability-technical-solution"],
        aggregateVersion: 1,
        createdAt: "2026-07-25T09:00:00.000Z",
        createdBy: "user-lead",
        updatedAt: "2026-07-25T09:00:00.000Z",
        updatedBy: "user-lead",
      },
      {
        id: "knowledge-rd-sop",
        scope: cloneMutable(canonicalScope),
        code: "ai-rd-delivery-sop",
        title: "AI 研发交付 SOP",
        description: "AI 研发员工执行、证据、验收与完成门禁。",
        source: {
          sourceType: "SOP",
          sourceLocation: "repository://rules/ai-rd-delivery.md",
          sourceAuthority: "研发管理组",
        },
        ownerId: "user-lead",
        classification: "INTERNAL",
        status: "ACTIVE",
        effectiveVersionId: sopVersion2.id,
        applicableScopes: scope("knowledge-rd-sop"),
        versions: [sopVersion1, sopVersion2],
        correctionRequests: [],
        referencedTaskIds: ["task-seed-executing"],
        referencedCapabilityIds: ["capability-technical-solution"],
        aggregateVersion: 2,
        createdAt: "2026-06-10T08:00:00.000Z",
        createdBy: "user-lead",
        updatedAt: "2026-07-20T08:00:00.000Z",
        updatedBy: "user-lead",
      },
      {
        id: "knowledge-release-checklist",
        scope: cloneMutable(canonicalScope),
        code: "release-checklist",
        title: "研发发布检查清单",
        description: "发布前质量、回退和证据检查。",
        source: {
          sourceType: "SOP",
          sourceLocation: "repository://rules/release-checklist.md",
          sourceAuthority: "研发效能组",
        },
        ownerId: "user-lead",
        classification: "INTERNAL",
        status: "ACTIVE",
        applicableScopes: scope("knowledge-release-checklist"),
        versions: [releaseVersion],
        correctionRequests: [],
        referencedTaskIds: [],
        referencedCapabilityIds: [],
        aggregateVersion: 1,
        createdAt: "2026-07-24T10:00:00.000Z",
        createdBy: "user-lead",
        updatedAt: "2026-07-24T10:00:00.000Z",
        updatedBy: "user-lead",
      },
      {
        id: "knowledge-ai-security-baseline",
        scope: cloneMutable(canonicalScope),
        code: "ai-security-baseline",
        title: "AI 安全基线",
        description: "敏感 Knowledge、Prompt Injection 与 Tool Policy 边界。",
        source: {
          sourceType: "DOCUMENT",
          sourceLocation: "repository://rules/ai-security.md",
          sourceAuthority: "安全治理组",
        },
        ownerId: "user-admin",
        classification: "CONFIDENTIAL",
        status: "ACTIVE",
        effectiveVersionId: securityVersion.id,
        applicableScopes: scope("knowledge-ai-security-baseline"),
        versions: [securityVersion],
        correctionRequests: [],
        referencedTaskIds: [],
        referencedCapabilityIds: [],
        aggregateVersion: 1,
        createdAt: "2026-07-21T06:00:00.000Z",
        createdBy: "user-admin",
        updatedAt: "2026-07-21T06:00:00.000Z",
        updatedBy: "user-admin",
      },
    ],
  };
}

function isPipelineStage(
  value: unknown,
  index: number,
): value is KnowledgePipelineStage {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "name",
      "status",
      "processorVersion",
      "summary",
      "completedAt",
    ]) &&
    value.name === pipelineStageNames[index] &&
    (value.status === "SUCCEEDED" || value.status === "FAILED") &&
    isNonEmptyString(value.processorVersion) &&
    isNonEmptyString(value.summary) &&
    isIsoTimestamp(value.completedAt)
  );
}

function isKnowledgeVersion(
  value: unknown,
  knowledgeId: string,
  index: number,
): value is KnowledgeVersion {
  if (
    !isRecord(value) ||
    !hasExactKeys(
      value,
      [
        "id",
        "versionNumber",
        "effectiveStatus",
        "indexStatus",
        "rawContentReference",
        "contentDigest",
        "contentPreview",
        "parserVersion",
        "chunkerVersion",
        "embeddingModelVersion",
        "indexVersion",
        "validationSummary",
        "pipelineStages",
        "createdAt",
        "createdBy",
      ],
      [
        "supersedesVersionId",
        "publishedAt",
        "publishedBy",
        "invalidatedAt",
        "invalidatedBy",
        "invalidationReason",
      ],
    ) ||
    value.id !== `${knowledgeId}-v${index + 1}` ||
    value.versionNumber !== index + 1 ||
    !effectiveStatuses.has(String(value.effectiveStatus)) ||
    !indexStatuses.has(String(value.indexStatus)) ||
    !isDigest(value.contentDigest) ||
    !isNonEmptyString(value.contentPreview) ||
    new TextEncoder().encode(value.contentPreview).byteLength >
      MAX_CONTENT_BYTES ||
    value.parserVersion !== "mock-parser-v1" ||
    value.chunkerVersion !== "mock-chunker-v1" ||
    value.embeddingModelVersion !== "mock-embedding-v1" ||
    !Number.isSafeInteger(value.indexVersion) ||
    Number(value.indexVersion) < 1 ||
    !Array.isArray(value.pipelineStages) ||
    value.pipelineStages.length !== pipelineStageNames.length ||
    !value.pipelineStages.every(isPipelineStage) ||
    !isIsoTimestamp(value.createdAt) ||
    !validActorIds.has(String(value.createdBy))
  ) {
    return false;
  }

  const contentReference = value.rawContentReference;
  const validation = value.validationSummary;
  if (
    !isRecord(contentReference) ||
    !hasExactKeys(contentReference, [
      "storageProvider",
      "objectKey",
      "storageVersion",
      "mediaType",
      "sizeBytes",
      "fileName",
    ]) ||
    contentReference.storageProvider !== "MOCK_CONTENT_STORE" ||
    !isNonEmptyString(contentReference.objectKey) ||
    !isNonEmptyString(contentReference.storageVersion) ||
    (contentReference.mediaType !== "text/plain" &&
      contentReference.mediaType !== "text/markdown") ||
    !Number.isSafeInteger(contentReference.sizeBytes) ||
    Number(contentReference.sizeBytes) < 1 ||
    Number(contentReference.sizeBytes) > MAX_CONTENT_BYTES ||
    !isNonEmptyString(contentReference.fileName) ||
    !isRecord(validation) ||
    !hasExactKeys(validation, [
      "sourceVerified",
      "structureValid",
      "retrievalPassed",
      "permissionNegativePassed",
      "chunkCount",
      "citationCoverage",
    ]) ||
    typeof validation.sourceVerified !== "boolean" ||
    typeof validation.structureValid !== "boolean" ||
    typeof validation.retrievalPassed !== "boolean" ||
    typeof validation.permissionNegativePassed !== "boolean" ||
    !Number.isSafeInteger(validation.chunkCount) ||
    Number(validation.chunkCount) < 1 ||
    validation.citationCoverage !== 1
  ) {
    return false;
  }

  if (
    index > 0 &&
    value.supersedesVersionId !== `${knowledgeId}-v${index}`
  ) {
    return false;
  }
  if (index === 0 && value.supersedesVersionId !== undefined) {
    return false;
  }
  if (value.effectiveStatus === "EFFECTIVE") {
    return (
      value.indexStatus === "READY" &&
      isIsoTimestamp(value.publishedAt) &&
      validActorIds.has(String(value.publishedBy)) &&
      value.invalidatedAt === undefined &&
      value.invalidatedBy === undefined &&
      value.invalidationReason === undefined
    );
  }
  if (value.effectiveStatus === "INVALIDATED") {
    return (
      isIsoTimestamp(value.publishedAt) &&
      validActorIds.has(String(value.publishedBy)) &&
      isIsoTimestamp(value.invalidatedAt) &&
      validActorIds.has(String(value.invalidatedBy)) &&
      isNonEmptyString(value.invalidationReason)
    );
  }
  return (
    value.publishedAt === undefined &&
    value.publishedBy === undefined &&
    value.invalidatedAt === undefined &&
    value.invalidatedBy === undefined &&
    value.invalidationReason === undefined
  );
}

function isCorrection(
  value: unknown,
  knowledgeId: string,
): value is KnowledgeCorrectionRequest {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "id",
      "targetVersionId",
      "submittedBy",
      "reason",
      "evidenceReference",
      "evidenceDigest",
      "status",
      "createdAt",
    ]) &&
    isNonEmptyString(value.id) &&
    value.id.startsWith(`correction-${knowledgeId}-`) &&
    isNonEmptyString(value.targetVersionId) &&
    validActorIds.has(String(value.submittedBy)) &&
    isNonEmptyString(value.reason) &&
    isNonEmptyString(value.evidenceReference) &&
    isDigest(value.evidenceDigest) &&
    ["OPEN", "ACCEPTED", "REJECTED", "CLOSED"].includes(
      String(value.status),
    ) &&
    isIsoTimestamp(value.createdAt)
  );
}

function isKnowledgeItem(value: unknown): value is KnowledgeItem {
  if (
    !isRecord(value) ||
    !hasExactKeys(
      value,
      [
        "id",
        "scope",
        "code",
        "title",
        "description",
        "source",
        "ownerId",
        "classification",
        "status",
        "applicableScopes",
        "versions",
        "correctionRequests",
        "referencedTaskIds",
        "referencedCapabilityIds",
        "aggregateVersion",
        "createdAt",
        "createdBy",
        "updatedAt",
        "updatedBy",
      ],
      ["effectiveVersionId", "archivedAt"],
    ) ||
    !isNonEmptyString(value.id) ||
    !value.id.startsWith("knowledge-") ||
    !isCanonicalScope(value.scope) ||
    !/^[a-z0-9][a-z0-9-]{2,63}$/.test(String(value.code)) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.description) ||
    !validActorIds.has(String(value.ownerId)) ||
    !classifications.has(String(value.classification)) ||
    (value.status !== "ACTIVE" && value.status !== "ARCHIVED") ||
    !Array.isArray(value.applicableScopes) ||
    value.applicableScopes.length !== 1 ||
    !Array.isArray(value.versions) ||
    value.versions.length < 1 ||
    !value.versions.every((version, index) =>
      isKnowledgeVersion(version, String(value.id), index),
    ) ||
    !Array.isArray(value.correctionRequests) ||
    !value.correctionRequests.every((correction) =>
      isCorrection(correction, String(value.id)),
    ) ||
    !isStringArray(value.referencedTaskIds) ||
    !isStringArray(value.referencedCapabilityIds) ||
    !Number.isSafeInteger(value.aggregateVersion) ||
    Number(value.aggregateVersion) < 1 ||
    !isIsoTimestamp(value.createdAt) ||
    !validActorIds.has(String(value.createdBy)) ||
    !isIsoTimestamp(value.updatedAt) ||
    !validActorIds.has(String(value.updatedBy)) ||
    String(value.updatedAt) < String(value.createdAt)
  ) {
    return false;
  }

  const source = value.source;
  const applicableScope = value.applicableScopes[0];
  if (
    !isRecord(source) ||
    !hasExactKeys(source, [
      "sourceType",
      "sourceLocation",
      "sourceAuthority",
    ]) ||
    !sourceTypes.has(String(source.sourceType)) ||
    !isNonEmptyString(source.sourceLocation) ||
    !isNonEmptyString(source.sourceAuthority) ||
    !isRecord(applicableScope) ||
    !hasExactKeys(applicableScope, [
      "scopeType",
      "scopeId",
      "purpose",
      "scopeDigest",
    ]) ||
    applicableScope.scopeType !== "WORKSPACE" ||
    applicableScope.scopeId !== canonicalScope.workspaceId ||
    applicableScope.purpose !== "software_engineering_tasks" ||
    !isDigest(applicableScope.scopeDigest)
  ) {
    return false;
  }

  const effectiveVersions = value.versions.filter(
    (version: KnowledgeVersion) =>
      version.effectiveStatus === "EFFECTIVE",
  );
  if (value.effectiveVersionId === undefined) {
    if (effectiveVersions.length !== 0) {
      return false;
    }
  } else if (
    effectiveVersions.length !== 1 ||
    effectiveVersions[0].id !== value.effectiveVersionId
  ) {
    return false;
  }

  return (
    (value.status === "ACTIVE" && value.archivedAt === undefined) ||
    (value.status === "ARCHIVED" && isIsoTimestamp(value.archivedAt))
  );
}

function isEnvelope(value: unknown): value is KnowledgeStoreEnvelope {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "schemaVersion",
      "nextKnowledgeSequence",
      "nextCorrectionSequence",
      "items",
    ]) &&
    value.schemaVersion === STORE_SCHEMA_VERSION &&
    Number.isSafeInteger(value.nextKnowledgeSequence) &&
    Number(value.nextKnowledgeSequence) >= 1 &&
    Number.isSafeInteger(value.nextCorrectionSequence) &&
    Number(value.nextCorrectionSequence) >= 1 &&
    Array.isArray(value.items) &&
    value.items.every(isKnowledgeItem) &&
    new Set(
      value.items.map((item: KnowledgeItem) => item.id),
    ).size === value.items.length &&
    new Set(
      value.items.map((item: KnowledgeItem) => item.code.toLowerCase()),
    ).size === value.items.length
  );
}

function validateContentInput(
  input: CreateKnowledgeVersionInput,
): void {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, [
      "fileName",
      "mediaType",
      "content",
      "contentDigest",
    ]) ||
    !isNonEmptyString(input.fileName) ||
    (input.mediaType !== "text/plain" &&
      input.mediaType !== "text/markdown") ||
    !isNonEmptyString(input.content) ||
    new TextEncoder().encode(input.content).byteLength > MAX_CONTENT_BYTES ||
    !isDigest(input.contentDigest)
  ) {
    throw new KnowledgeRepositoryError(
      "VALIDATION",
      "Knowledge content is invalid or exceeds the 50 KB Mock limit.",
    );
  }
}

function validateRegisterInput(
  input: RegisterKnowledgeInput,
): void {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, [
      "code",
      "title",
      "description",
      "sourceType",
      "sourceLocation",
      "sourceAuthority",
      "ownerId",
      "classification",
      "purpose",
      "fileName",
      "mediaType",
      "content",
      "contentDigest",
    ]) ||
    !/^[a-z0-9][a-z0-9-]{2,63}$/.test(input.code) ||
    !isNonEmptyString(input.title) ||
    !isNonEmptyString(input.description) ||
    !sourceTypes.has(input.sourceType) ||
    !isNonEmptyString(input.sourceLocation) ||
    !isNonEmptyString(input.sourceAuthority) ||
    !validActorIds.has(input.ownerId) ||
    !classifications.has(input.classification) ||
    input.purpose !== "software_engineering_tasks"
  ) {
    throw new KnowledgeRepositoryError(
      "VALIDATION",
      "Knowledge profile is incomplete or invalid.",
    );
  }
  validateContentInput({
    fileName: input.fileName,
    mediaType: input.mediaType,
    content: input.content,
    contentDigest: input.contentDigest,
  });
}

function currentVersion(item: KnowledgeItem): KnowledgeVersion {
  return item.versions.at(-1)!;
}

function toListItem(item: KnowledgeItem): KnowledgeListItem {
  const version = currentVersion(item);
  return {
    id: item.id,
    code: item.code,
    title: item.title,
    sourceType: item.source.sourceType,
    sourceLocation: item.source.sourceLocation,
    ownerId: item.ownerId,
    classification: item.classification,
    status: item.status,
    effectiveStatus: version.effectiveStatus,
    indexStatus: version.indexStatus,
    currentVersionNumber: version.versionNumber,
    currentVersionId: version.id,
    referencedTaskCount: item.referencedTaskIds.length,
    referencedCapabilityCount: item.referencedCapabilityIds.length,
    openCorrectionCount: item.correctionRequests.filter(
      ({ status }) => status === "OPEN",
    ).length,
    updatedAt: item.updatedAt,
  };
}

function normalizeQuery(query: KnowledgeQuery): {
  page: number;
  pageSize: number;
} {
  const rawQuery: unknown = query;
  if (!isRecord(rawQuery)) {
    throw new KnowledgeRepositoryError(
      "VALIDATION",
      "Knowledge query is invalid.",
    );
  }
  const page = rawQuery.page ?? 1;
  const pageSize = rawQuery.pageSize ?? 10;
  if (
    typeof page !== "number" ||
    !Number.isInteger(page) ||
    page < 1 ||
    typeof pageSize !== "number" ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 50 ||
    (rawQuery.keyword !== undefined &&
      typeof rawQuery.keyword !== "string") ||
    (rawQuery.effectiveStatus !== undefined &&
      (typeof rawQuery.effectiveStatus !== "string" ||
        !effectiveStatuses.has(rawQuery.effectiveStatus))) ||
    (rawQuery.indexStatus !== undefined &&
      (typeof rawQuery.indexStatus !== "string" ||
        !indexStatuses.has(rawQuery.indexStatus))) ||
    (rawQuery.classification !== undefined &&
      (typeof rawQuery.classification !== "string" ||
        !classifications.has(rawQuery.classification)))
  ) {
    throw new KnowledgeRepositoryError(
      "VALIDATION",
      "Knowledge query contains unsupported filters.",
    );
  }
  return { page, pageSize };
}

function scoreContent(content: string, query: string): number {
  const normalizedContent = content.toLocaleLowerCase();
  const normalizedQuery = query.toLocaleLowerCase().trim();
  if (normalizedContent.includes(normalizedQuery)) {
    return 1;
  }
  const tokens = normalizedQuery
    .split(/[\s，。；、,.!?：:()（）/]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    return 0;
  }
  return (
    tokens.filter((token) => normalizedContent.includes(token)).length /
    tokens.length
  );
}

function excerptFor(content: string, query: string): string {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const ranked = paragraphs
    .map((paragraph, index) => ({
      paragraph,
      index,
      score: scoreContent(paragraph, query),
    }))
    .sort(
      (left, right) =>
        right.score - left.score || left.index - right.index,
    );
  return ranked[0]?.paragraph.slice(0, 360) ?? content.slice(0, 360);
}

export async function digestKnowledgeContent(
  content: string,
): Promise<string> {
  if (
    !isNonEmptyString(content) ||
    new TextEncoder().encode(content).byteLength > MAX_CONTENT_BYTES
  ) {
    throw new KnowledgeRepositoryError(
      "VALIDATION",
      "Knowledge content is empty or exceeds the 50 KB Mock limit.",
    );
  }
  if (!globalThis.crypto?.subtle) {
    throw new KnowledgeRepositoryError(
      "VALIDATION",
      "The browser SHA-256 implementation is unavailable.",
    );
  }
  const buffer = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return `sha256:${Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function createKnowledgeRepository(
  options: CreateKnowledgeRepositoryOptions = {},
): KnowledgeRepository {
  const storage = options.storage ?? getBrowserStorage();
  const delay = options.delay ?? defaultDelay;
  const now = options.now ?? (() => new Date().toISOString());

  function timestamp(): string {
    const value = now();
    if (!isIsoTimestamp(value)) {
      throw new KnowledgeRepositoryError(
        "VALIDATION",
        "Knowledge clock must return an ISO 8601 UTC timestamp.",
      );
    }
    return value;
  }

  function readEnvelope(): KnowledgeStoreEnvelope {
    let raw: string | null;
    try {
      raw = storage.getItem(KNOWLEDGE_STORE_KEY);
    } catch {
      throw new KnowledgeRepositoryError(
        "INVALID_STORE",
        "Knowledge store is unavailable.",
      );
    }
    if (raw === null) {
      return defaultEnvelope();
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isEnvelope(parsed)) {
        throw new Error("invalid");
      }
      return parsed;
    } catch {
      try {
        storage.removeItem(KNOWLEDGE_STORE_KEY);
      } catch {
        // Fail-closed state remains authoritative.
      }
      throw new KnowledgeRepositoryError(
        "INVALID_STORE",
        "Knowledge store failed integrity validation and was cleared.",
      );
    }
  }

  function writeEnvelope(envelope: KnowledgeStoreEnvelope): void {
    if (!isEnvelope(envelope)) {
      throw new KnowledgeRepositoryError(
        "INVALID_STORE",
        "Knowledge store write failed integrity validation.",
      );
    }
    try {
      storage.setItem(KNOWLEDGE_STORE_KEY, JSON.stringify(envelope));
    } catch {
      throw new KnowledgeRepositoryError(
        "VALIDATION",
        "Knowledge store could not persist this change.",
      );
    }
  }

  function prepare(
    scope: KnowledgeScope,
    actor: KnowledgeActor,
  ): KnowledgeStoreEnvelope {
    validateScope(scope);
    validateActor(actor);
    return readEnvelope();
  }

  function mutableItem(
    envelope: KnowledgeStoreEnvelope,
    actor: KnowledgeActor,
    knowledgeId: string,
  ): KnowledgeItem {
    if (!isNonEmptyString(knowledgeId)) {
      throw new KnowledgeRepositoryError(
        "VALIDATION",
        "Knowledge ID is invalid.",
      );
    }
    const item = envelope.items.find(({ id }) => id === knowledgeId);
    if (!item || !canReadItem(item, actor)) {
      throw new KnowledgeRepositoryError(
        "NOT_FOUND",
        "Knowledge was not found.",
      );
    }
    return item;
  }

  function touch(
    item: KnowledgeItem,
    actor: KnowledgeActor,
    value: string,
  ): void {
    item.aggregateVersion += 1;
    item.updatedAt = value;
    item.updatedBy = actor.userId;
  }

  return {
    async getPermission(scope, actor) {
      await delay();
      prepare(scope, actor);
      return cloneMutable(permissionFor(actor));
    },

    async listKnowledge(scope, actor, query = {}) {
      await delay();
      const envelope = prepare(scope, actor);
      const { page, pageSize } = normalizeQuery(query);
      const keyword = query.keyword?.trim().toLocaleLowerCase();
      const items = envelope.items
        .filter(
          (item) =>
            canReadItem(item, actor) &&
            item.status === "ACTIVE",
        )
        .map(toListItem)
        .filter(
          (item) =>
            (!keyword ||
              `${item.title}${item.code}${item.sourceLocation}`
                .toLocaleLowerCase()
                .includes(keyword)) &&
            (!query.effectiveStatus ||
              item.effectiveStatus === query.effectiveStatus) &&
            (!query.indexStatus ||
              item.indexStatus === query.indexStatus) &&
            (!query.classification ||
              item.classification === query.classification),
        )
        .sort(
          (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) ||
            left.id.localeCompare(right.id),
        );
      const offset = (page - 1) * pageSize;
      return {
        total: items.length,
        page,
        pageSize,
        items: cloneMutable(items.slice(offset, offset + pageSize)),
      };
    },

    async getSummary(scope, actor) {
      await delay();
      const envelope = prepare(scope, actor);
      const visible = envelope.items
        .filter(
          (item) =>
            canReadItem(item, actor) &&
            item.status === "ACTIVE",
        )
        .map(toListItem);
      return {
        total: visible.length,
        effective: visible.filter(
          ({ effectiveStatus, indexStatus }) =>
            effectiveStatus === "EFFECTIVE" &&
            indexStatus === "READY",
        ).length,
        draft: visible.filter(
          ({ effectiveStatus }) => effectiveStatus === "DRAFT",
        ).length,
        attention: visible.filter(
          ({ effectiveStatus, indexStatus, openCorrectionCount }) =>
            effectiveStatus === "INVALIDATED" ||
            ["FAILED", "STALE"].includes(indexStatus) ||
            openCorrectionCount > 0,
        ).length,
      };
    },

    async getKnowledge(scope, actor, knowledgeId) {
      await delay();
      const envelope = prepare(scope, actor);
      return cloneMutable(mutableItem(envelope, actor, knowledgeId));
    },

    async registerKnowledge(scope, actor, input) {
      await delay();
      const envelope = prepare(scope, actor);
      requireManager(actor);
      validateRegisterInput(input);
      if (
        envelope.items.some(
          ({ code }) => code.toLowerCase() === input.code.toLowerCase(),
        )
      ) {
        throw new KnowledgeRepositoryError(
          "CONFLICT",
          "Knowledge code already exists in this Workspace.",
        );
      }
      const sequence = envelope.nextKnowledgeSequence;
      const knowledgeId = `knowledge-mock-${String(sequence).padStart(4, "0")}`;
      const currentTimestamp = timestamp();
      const version = createVersionRecord({
        knowledgeId,
        versionNumber: 1,
        input,
        actorId: actor.userId,
        timestamp: currentTimestamp,
      });
      const item: KnowledgeItem = {
        id: knowledgeId,
        scope: cloneMutable(scope),
        code: input.code,
        title: input.title,
        description: input.description,
        source: {
          sourceType: input.sourceType,
          sourceLocation: input.sourceLocation,
          sourceAuthority: input.sourceAuthority,
        },
        ownerId: input.ownerId,
        classification: input.classification,
        status: "ACTIVE",
        applicableScopes: [
          {
            scopeType: "WORKSPACE",
            scopeId: scope.workspaceId,
            purpose: input.purpose,
            scopeDigest: `sha256:scope:${knowledgeId}:${scope.workspaceId}`,
          },
        ],
        versions: [version],
        correctionRequests: [],
        referencedTaskIds: [],
        referencedCapabilityIds: [],
        aggregateVersion: 1,
        createdAt: currentTimestamp,
        createdBy: actor.userId,
        updatedAt: currentTimestamp,
        updatedBy: actor.userId,
      };
      envelope.items.push(item);
      envelope.nextKnowledgeSequence += 1;
      writeEnvelope(envelope);
      return cloneMutable(item);
    },

    async createVersion(scope, actor, knowledgeId, input) {
      await delay();
      const envelope = prepare(scope, actor);
      requireManager(actor);
      validateContentInput(input);
      const item = mutableItem(envelope, actor, knowledgeId);
      if (
        item.status !== "ACTIVE" ||
        item.versions.some(
          ({ effectiveStatus }) => effectiveStatus === "DRAFT",
        )
      ) {
        throw new KnowledgeRepositoryError(
          "CONFLICT",
          "Knowledge already has an active Draft version.",
        );
      }
      const currentTimestamp = timestamp();
      const latest = currentVersion(item);
      item.versions.push(
        createVersionRecord({
          knowledgeId,
          versionNumber: latest.versionNumber + 1,
          input,
          actorId: actor.userId,
          timestamp: currentTimestamp,
          supersedesVersionId: latest.id,
        }),
      );
      touch(item, actor, currentTimestamp);
      writeEnvelope(envelope);
      return cloneMutable(item);
    },

    async publishVersion(scope, actor, knowledgeId, versionId) {
      await delay();
      const envelope = prepare(scope, actor);
      requireManager(actor);
      const item = mutableItem(envelope, actor, knowledgeId);
      const version = item.versions.find(({ id }) => id === versionId);
      if (!version) {
        throw new KnowledgeRepositoryError(
          "NOT_FOUND",
          "KnowledgeVersion was not found.",
        );
      }
      if (
        version.effectiveStatus !== "DRAFT" ||
        version.indexStatus !== "READY" ||
        !version.validationSummary.sourceVerified ||
        !version.validationSummary.structureValid ||
        !version.validationSummary.retrievalPassed ||
        !version.validationSummary.permissionNegativePassed
      ) {
        throw new KnowledgeRepositoryError(
          "INDEX_NOT_READY",
          "KnowledgeVersion cannot become Effective before validation.",
        );
      }
      const currentTimestamp = timestamp();
      for (const candidate of item.versions) {
        if (candidate.effectiveStatus === "EFFECTIVE") {
          candidate.effectiveStatus = "INVALIDATED";
          candidate.invalidatedAt = currentTimestamp;
          candidate.invalidatedBy = actor.userId;
          candidate.invalidationReason = `由 ${version.id} 替代，历史 Citation 保留。`;
        }
      }
      version.effectiveStatus = "EFFECTIVE";
      version.publishedAt = currentTimestamp;
      version.publishedBy = actor.userId;
      item.effectiveVersionId = version.id;
      touch(item, actor, currentTimestamp);
      writeEnvelope(envelope);
      return cloneMutable(item);
    },

    async invalidateVersion(
      scope,
      actor,
      knowledgeId,
      versionId,
      reason,
    ) {
      await delay();
      const envelope = prepare(scope, actor);
      requireManager(actor);
      if (!isNonEmptyString(reason) || reason.trim().length < 8) {
        throw new KnowledgeRepositoryError(
          "VALIDATION",
          "Invalidation reason must contain at least 8 characters.",
        );
      }
      const item = mutableItem(envelope, actor, knowledgeId);
      const version = item.versions.find(({ id }) => id === versionId);
      if (!version || version.effectiveStatus !== "EFFECTIVE") {
        throw new KnowledgeRepositoryError(
          "CONFLICT",
          "Only an Effective KnowledgeVersion can be invalidated.",
        );
      }
      const currentTimestamp = timestamp();
      version.effectiveStatus = "INVALIDATED";
      version.invalidatedAt = currentTimestamp;
      version.invalidatedBy = actor.userId;
      version.invalidationReason = reason.trim();
      if (item.effectiveVersionId === version.id) {
        delete item.effectiveVersionId;
      }
      touch(item, actor, currentTimestamp);
      writeEnvelope(envelope);
      return cloneMutable(item);
    },

    async restoreVersion(
      scope,
      actor,
      knowledgeId,
      versionId,
      reason,
    ) {
      await delay();
      const envelope = prepare(scope, actor);
      requireManager(actor);
      if (!isNonEmptyString(reason) || reason.trim().length < 8) {
        throw new KnowledgeRepositoryError(
          "VALIDATION",
          "Restore reason must contain at least 8 characters.",
        );
      }
      const item = mutableItem(envelope, actor, knowledgeId);
      const version = item.versions.find(({ id }) => id === versionId);
      if (
        !version ||
        version.effectiveStatus !== "INVALIDATED" ||
        version.indexStatus !== "READY"
      ) {
        throw new KnowledgeRepositoryError(
          "INDEX_NOT_READY",
          "Only an Invalidated and Ready KnowledgeVersion can be restored.",
        );
      }
      const currentTimestamp = timestamp();
      for (const candidate of item.versions) {
        if (candidate.effectiveStatus === "EFFECTIVE") {
          candidate.effectiveStatus = "INVALIDATED";
          candidate.invalidatedAt = currentTimestamp;
          candidate.invalidatedBy = actor.userId;
          candidate.invalidationReason = `恢复 ${version.id} 时失效。`;
        }
      }
      version.effectiveStatus = "EFFECTIVE";
      version.publishedAt = currentTimestamp;
      version.publishedBy = actor.userId;
      delete version.invalidatedAt;
      delete version.invalidatedBy;
      delete version.invalidationReason;
      item.effectiveVersionId = version.id;
      touch(item, actor, currentTimestamp);
      writeEnvelope(envelope);
      return cloneMutable(item);
    },

    async submitCorrection(scope, actor, knowledgeId, input) {
      await delay();
      const envelope = prepare(scope, actor);
      requireCorrectionPermission(actor);
      if (
        !isRecord(input) ||
        !hasExactKeys(input, [
          "targetVersionId",
          "reason",
          "evidenceReference",
          "evidenceDigest",
        ]) ||
        !isNonEmptyString(input.targetVersionId) ||
        !isNonEmptyString(input.reason) ||
        input.reason.trim().length < 8 ||
        !isNonEmptyString(input.evidenceReference) ||
        !isDigest(input.evidenceDigest)
      ) {
        throw new KnowledgeRepositoryError(
          "VALIDATION",
          "Correction request requires a target, reason and evidence.",
        );
      }
      const item = mutableItem(envelope, actor, knowledgeId);
      if (
        !item.versions.some(({ id }) => id === input.targetVersionId)
      ) {
        throw new KnowledgeRepositoryError(
          "NOT_FOUND",
          "Correction target version was not found.",
        );
      }
      const sequence = envelope.nextCorrectionSequence;
      const currentTimestamp = timestamp();
      item.correctionRequests.push({
        id: `correction-${knowledgeId}-${String(sequence).padStart(4, "0")}`,
        targetVersionId: input.targetVersionId,
        submittedBy: actor.userId,
        reason: input.reason.trim(),
        evidenceReference: input.evidenceReference.trim(),
        evidenceDigest: input.evidenceDigest,
        status: "OPEN",
        createdAt: currentTimestamp,
      });
      envelope.nextCorrectionSequence += 1;
      touch(item, actor, currentTimestamp);
      writeEnvelope(envelope);
      return cloneMutable(item);
    },

    async retrieve(scope, actor, query) {
      await delay();
      const envelope = prepare(scope, actor);
      if (!isNonEmptyString(query) || query.trim().length > 300) {
        throw new KnowledgeRepositoryError(
          "VALIDATION",
          "Retrieval query must contain 1 to 300 characters.",
        );
      }
      const normalizedQuery = query.trim();
      const ranked = envelope.items
        .filter(
          (item) =>
            canReadItem(item, actor) &&
            item.status === "ACTIVE" &&
            item.effectiveVersionId,
        )
        .flatMap((item) => {
          const version = item.versions.find(
            ({ id }) => id === item.effectiveVersionId,
          );
          if (
            !version ||
            version.effectiveStatus !== "EFFECTIVE" ||
            version.indexStatus !== "READY"
          ) {
            return [];
          }
          const titleScore = scoreContent(item.title, normalizedQuery);
          const contentScore = scoreContent(
            version.contentPreview,
            normalizedQuery,
          );
          const score = Math.max(titleScore, contentScore);
          if (score <= 0) {
            return [];
          }
          const excerpt = excerptFor(
            version.contentPreview,
            normalizedQuery,
          );
          return [
            {
              knowledgeId: item.id,
              knowledgeTitle: item.title,
              versionId: version.id,
              versionNumber: version.versionNumber,
              excerpt,
              score: Number((0.55 + score * 0.43).toFixed(3)),
              sparseScore: Number((0.5 + score * 0.45).toFixed(3)),
              denseScore: Number((0.52 + score * 0.4).toFixed(3)),
              citation: {
                knowledgeVersionId: version.id,
                contentLocation: "content:paragraph-best-match",
                citationDigest: `sha256:citation:${version.id}:paragraph-best-match`,
              },
            },
          ];
        })
        .sort(
          (left, right) =>
            right.score - left.score ||
            left.knowledgeId.localeCompare(right.knowledgeId),
        )
        .slice(0, 5);
      return {
        outcome: ranked.length > 0 ? "RESULTS" : "EMPTY",
        query: normalizedQuery,
        purpose: "software_engineering_tasks",
        permissionDigest: `sha256:permission:${actor.userId}:${scope.workspaceId}`,
        scopeDigest: `sha256:scope:${scope.organizationId}:${scope.workspaceId}`,
        retrievalMode: "DETERMINISTIC_MOCK_HYBRID",
        results: cloneMutable(ranked),
        executedAt: timestamp(),
      };
    },
  };
}

function defaultRepository(): KnowledgeRepository {
  return createKnowledgeRepository();
}

export async function getKnowledgePermission(
  scope: KnowledgeScope,
  actor: KnowledgeActor,
) {
  return defaultRepository().getPermission(scope, actor);
}

export async function listKnowledge(
  scope: KnowledgeScope,
  actor: KnowledgeActor,
  query: KnowledgeQuery = {},
) {
  return defaultRepository().listKnowledge(scope, actor, query);
}

export async function getKnowledgeSummary(
  scope: KnowledgeScope,
  actor: KnowledgeActor,
) {
  return defaultRepository().getSummary(scope, actor);
}

export async function getKnowledge(
  scope: KnowledgeScope,
  actor: KnowledgeActor,
  knowledgeId: string,
) {
  return defaultRepository().getKnowledge(scope, actor, knowledgeId);
}

export async function registerKnowledge(
  scope: KnowledgeScope,
  actor: KnowledgeActor,
  input: RegisterKnowledgeInput,
) {
  return defaultRepository().registerKnowledge(scope, actor, input);
}

export async function createKnowledgeVersion(
  scope: KnowledgeScope,
  actor: KnowledgeActor,
  knowledgeId: string,
  input: CreateKnowledgeVersionInput,
) {
  return defaultRepository().createVersion(
    scope,
    actor,
    knowledgeId,
    input,
  );
}

export async function publishKnowledgeVersion(
  scope: KnowledgeScope,
  actor: KnowledgeActor,
  knowledgeId: string,
  versionId: string,
) {
  return defaultRepository().publishVersion(
    scope,
    actor,
    knowledgeId,
    versionId,
  );
}

export async function invalidateKnowledgeVersion(
  scope: KnowledgeScope,
  actor: KnowledgeActor,
  knowledgeId: string,
  versionId: string,
  reason: string,
) {
  return defaultRepository().invalidateVersion(
    scope,
    actor,
    knowledgeId,
    versionId,
    reason,
  );
}

export async function restoreKnowledgeVersion(
  scope: KnowledgeScope,
  actor: KnowledgeActor,
  knowledgeId: string,
  versionId: string,
  reason: string,
) {
  return defaultRepository().restoreVersion(
    scope,
    actor,
    knowledgeId,
    versionId,
    reason,
  );
}

export async function submitKnowledgeCorrection(
  scope: KnowledgeScope,
  actor: KnowledgeActor,
  knowledgeId: string,
  input: SubmitCorrectionInput,
) {
  return defaultRepository().submitCorrection(
    scope,
    actor,
    knowledgeId,
    input,
  );
}

export async function retrieveKnowledge(
  scope: KnowledgeScope,
  actor: KnowledgeActor,
  query: string,
) {
  return defaultRepository().retrieve(scope, actor, query);
}
