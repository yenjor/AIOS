import { users } from "@/mock/fixtures";

import type {
  ArtifactActor,
  ArtifactScope,
  TechnicalSolutionArtifact,
  TechnicalSolutionArtifactDraft,
} from "../model";

export const ARTIFACT_STORE_KEY = "aios.mock.artifact-store.v1";
const ARTIFACT_STORE_SCHEMA_VERSION = 1;
const DEFAULT_LATENCY_MS = 30;

export type ArtifactRepositoryErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_STORE"
  | "VALIDATION";

export class ArtifactRepositoryError extends Error {
  constructor(
    public readonly code: ArtifactRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ArtifactRepositoryError";
  }
}

export interface ArtifactStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ArtifactRepository {
  getArtifact(
    scope: ArtifactScope,
    actor: ArtifactActor,
    artifactId: string,
  ): Promise<TechnicalSolutionArtifact>;
  submitTechnicalSolution(
    producerAgentId: "agent-rd-001",
    draft: TechnicalSolutionArtifactDraft,
  ): Promise<TechnicalSolutionArtifact>;
  acceptArtifact(
    scope: ArtifactScope,
    actor: ArtifactActor,
    artifactId: string,
  ): Promise<TechnicalSolutionArtifact>;
}

export interface CreateArtifactRepositoryOptions {
  storage?: ArtifactStorage;
  delay?: () => Promise<void>;
  now?: () => string;
}

interface ArtifactStoreEnvelope {
  schemaVersion: 1;
  artifacts: TechnicalSolutionArtifact[];
}

const canonicalScope: ArtifactScope = {
  organizationId: "org-guangwei",
  workspaceId: "ws-ai",
};
const validActorIds = new Set(users.map(({ id }) => id));
const technicalSolutionSectionTitles = [
  "目标理解",
  "范围与不做事项",
  "影响模块与文件",
  "技术决策",
  "风险",
  "测试建议",
  "回退考虑",
  "Knowledge Citation",
] as const;
const validationNames = [
  "Artifact 结构完整性",
  "Knowledge Citation 可追溯",
  "Reviewer 人工验收",
] as const;

function defaultDelay(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, DEFAULT_LATENCY_MS);
  });
}

function getBrowserStorage(): ArtifactStorage {
  if (typeof window === "undefined") {
    throw new ArtifactRepositoryError(
      "INVALID_STORE",
      "Artifact store is only available in the browser mock runtime.",
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
  return (
    Array.isArray(value) &&
    value.every((item) => isNonEmptyString(item))
  );
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isArtifactScope(value: unknown): value is ArtifactScope {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["organizationId", "workspaceId"]) &&
    value.organizationId === canonicalScope.organizationId &&
    value.workspaceId === canonicalScope.workspaceId
  );
}

function validateScope(scope: unknown): asserts scope is ArtifactScope {
  if (!isArtifactScope(scope)) {
    throw new ArtifactRepositoryError(
      "NOT_FOUND",
      "Artifact scope is unavailable.",
    );
  }
}

function validateActor(actor: unknown): asserts actor is ArtifactActor {
  if (
    !isRecord(actor) ||
    !hasExactKeys(actor, ["userId"]) ||
    !isNonEmptyString(actor.userId) ||
    !validActorIds.has(actor.userId)
  ) {
    throw new ArtifactRepositoryError(
      "FORBIDDEN",
      "Artifact actor is unavailable.",
    );
  }
}

function isArtifactSection(value: unknown, index: number): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["title", "paragraphs"]) &&
    value.title === technicalSolutionSectionTitles[index] &&
    isStringArray(value.paragraphs)
  );
}

function isValidationResult(
  value: unknown,
  artifactId: string,
  artifactStatus: "PENDING_REVIEW" | "ACCEPTED",
  index: number,
): boolean {
  const expectedStatus =
    index < 2 || artifactStatus === "ACCEPTED" ? "PASSED" : "PENDING";
  return (
    isRecord(value) &&
    hasExactKeys(value, ["id", "name", "status", "summary"]) &&
    value.id ===
      `${artifactId}-validation-${
        index === 0 ? "structure" : index === 1 ? "citation" : "review"
      }` &&
    value.name === validationNames[index] &&
    value.status === expectedStatus &&
    isNonEmptyString(value.summary)
  );
}

function isCitation(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["knowledgeVersionId", "locator", "digest"]) &&
    value.knowledgeVersionId === "knowledge-aios-docs-v1" &&
    value.locator === "README.md#5-系统整体架构" &&
    value.digest ===
      "sha256:citation:knowledge-aios-docs-v1:readme-architecture"
  );
}

function isArtifact(value: unknown): value is TechnicalSolutionArtifact {
  if (
    !isRecord(value) ||
    !hasExactKeys(
      value,
      [
        "id",
        "scope",
        "title",
        "artifactType",
        "status",
        "version",
        "sections",
        "validationResults",
        "citations",
        "provenance",
        "reviewerUserIds",
        "createdAt",
        "updatedAt",
      ],
      ["acceptedByUserId", "acceptedAt"],
    ) ||
    !isNonEmptyString(value.id) ||
    !value.id.startsWith("artifact-task-mock-") ||
    !isArtifactScope(value.scope) ||
    !isNonEmptyString(value.title) ||
    value.artifactType !== "技术方案" ||
    (value.status !== "PENDING_REVIEW" && value.status !== "ACCEPTED") ||
    !Array.isArray(value.sections) ||
    value.sections.length !== 8 ||
    !value.sections.every((section, index) =>
      isArtifactSection(section, index),
    ) ||
    !Array.isArray(value.validationResults) ||
    value.validationResults.length !== 3 ||
    !Array.isArray(value.citations) ||
    value.citations.length !== 1 ||
    !value.citations.every(isCitation) ||
    !Array.isArray(value.reviewerUserIds) ||
    value.reviewerUserIds.length !== 1 ||
    value.reviewerUserIds[0] !== "user-lead" ||
    !isIsoTimestamp(value.createdAt) ||
    !isIsoTimestamp(value.updatedAt) ||
    value.updatedAt < value.createdAt
  ) {
    return false;
  }

  const version = value.version;
  const provenance = value.provenance;
  const artifactId = value.id as string;
  const artifactStatus = value.status as
    | "PENDING_REVIEW"
    | "ACCEPTED";
  if (
    !isRecord(version) ||
    !hasExactKeys(version, [
      "artifactId",
      "versionId",
      "versionNumber",
      "digest",
    ]) ||
    version.artifactId !== value.id ||
    version.versionId !== `${value.id}-v1` ||
    version.versionNumber !== 1 ||
    version.digest !== `sha256:${value.id}-v1` ||
    !isRecord(provenance) ||
    !hasExactKeys(provenance, [
      "taskId",
      "runId",
      "agentVersionId",
      "capabilityVersionIds",
      "knowledgeVersionIds",
      "workflowVersionId",
      "toolVersionIds",
      "generatedAt",
      "contentDigest",
    ]) ||
    !isNonEmptyString(provenance.taskId) ||
    value.id !== `artifact-${provenance.taskId}` ||
    !isNonEmptyString(provenance.runId) ||
    provenance.agentVersionId !== "agent-rd-001-v1" ||
    !Array.isArray(provenance.capabilityVersionIds) ||
    provenance.capabilityVersionIds.length !== 1 ||
    provenance.capabilityVersionIds[0] !==
      "capability-technical-solution-v1" ||
    !Array.isArray(provenance.knowledgeVersionIds) ||
    provenance.knowledgeVersionIds.length !== 1 ||
    provenance.knowledgeVersionIds[0] !== "knowledge-aios-docs-v1" ||
    provenance.workflowVersionId !== "workflow-technical-solution-v1" ||
    !Array.isArray(provenance.toolVersionIds) ||
    provenance.toolVersionIds.length !== 1 ||
    provenance.toolVersionIds[0] !== "tool-codegraph-read-v1" ||
    !isIsoTimestamp(provenance.generatedAt) ||
    provenance.runId !== `run-${provenance.taskId}-01` ||
    provenance.contentDigest !== `sha256:${artifactId}-v1:content` ||
    !value.validationResults.every((result, index) =>
      isValidationResult(result, artifactId, artifactStatus, index),
    )
  ) {
    return false;
  }

  if (value.status === "ACCEPTED") {
    return (
      value.acceptedByUserId === "user-lead" &&
      isIsoTimestamp(value.acceptedAt) &&
      value.validationResults.every(({ status }) => status === "PASSED")
    );
  }

  return (
    value.acceptedByUserId === undefined &&
    value.acceptedAt === undefined &&
    value.validationResults.filter(({ status }) => status === "PASSED")
      .length === 2
  );
}

function isEnvelope(value: unknown): value is ArtifactStoreEnvelope {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["schemaVersion", "artifacts"]) &&
    value.schemaVersion === ARTIFACT_STORE_SCHEMA_VERSION &&
    Array.isArray(value.artifacts) &&
    value.artifacts.every(isArtifact) &&
    new Set(
      value.artifacts.map(
        (artifact: TechnicalSolutionArtifact) => artifact.id,
      ),
    ).size === value.artifacts.length
  );
}

function validateDraft(
  draft: unknown,
): asserts draft is TechnicalSolutionArtifactDraft {
  if (
    !isRecord(draft) ||
    !hasExactKeys(draft, [
      "scope",
      "taskId",
      "runId",
      "title",
      "sections",
      "citations",
      "agentVersionId",
      "capabilityVersionIds",
      "knowledgeVersionIds",
      "workflowVersionId",
      "toolVersionIds",
      "reviewerUserIds",
      "contentDigest",
    ]) ||
    !isArtifactScope(draft.scope) ||
    !isNonEmptyString(draft.taskId) ||
    !draft.taskId.startsWith("task-mock-") ||
    !isNonEmptyString(draft.runId) ||
    !isNonEmptyString(draft.title) ||
    !Array.isArray(draft.sections) ||
    draft.sections.length !== 8 ||
    !draft.sections.every((section, index) =>
      isArtifactSection(section, index),
    ) ||
    !Array.isArray(draft.citations) ||
    draft.citations.length !== 1 ||
    !draft.citations.every(isCitation) ||
    draft.agentVersionId !== "agent-rd-001-v1" ||
    !Array.isArray(draft.capabilityVersionIds) ||
    draft.capabilityVersionIds.length !== 1 ||
    draft.capabilityVersionIds[0] !==
      "capability-technical-solution-v1" ||
    !Array.isArray(draft.knowledgeVersionIds) ||
    draft.knowledgeVersionIds.length !== 1 ||
    draft.knowledgeVersionIds[0] !== "knowledge-aios-docs-v1" ||
    draft.workflowVersionId !== "workflow-technical-solution-v1" ||
    !Array.isArray(draft.toolVersionIds) ||
    draft.toolVersionIds.length !== 1 ||
    draft.toolVersionIds[0] !== "tool-codegraph-read-v1" ||
    !Array.isArray(draft.reviewerUserIds) ||
    draft.reviewerUserIds.length !== 1 ||
    draft.reviewerUserIds[0] !== "user-lead" ||
    draft.runId !== `run-${draft.taskId}-01` ||
    draft.contentDigest !== `sha256:artifact-${draft.taskId}-v1:content`
  ) {
    throw new ArtifactRepositoryError(
      "VALIDATION",
      "Technical solution Artifact draft is invalid.",
    );
  }
}

export function createArtifactRepository(
  options: CreateArtifactRepositoryOptions = {},
): ArtifactRepository {
  const storage = options.storage ?? getBrowserStorage();
  const delay = options.delay ?? defaultDelay;
  const now = options.now ?? (() => new Date().toISOString());

  function currentTimestamp(): string {
    const timestamp = now();
    if (!isIsoTimestamp(timestamp)) {
      throw new ArtifactRepositoryError(
        "VALIDATION",
        "Artifact clock must return an ISO 8601 UTC timestamp.",
      );
    }
    return timestamp;
  }

  function readEnvelope(): ArtifactStoreEnvelope {
    let raw: string | null;
    try {
      raw = storage.getItem(ARTIFACT_STORE_KEY);
    } catch {
      throw new ArtifactRepositoryError(
        "INVALID_STORE",
        "Artifact store is unavailable.",
      );
    }
    if (raw === null) {
      return { schemaVersion: 1, artifacts: [] };
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isEnvelope(parsed)) {
        throw new Error("invalid");
      }
      return parsed;
    } catch {
      try {
        storage.removeItem(ARTIFACT_STORE_KEY);
      } catch {
        // The fail-closed result remains authoritative.
      }
      throw new ArtifactRepositoryError(
        "INVALID_STORE",
        "Artifact store failed integrity validation and was cleared.",
      );
    }
  }

  function writeEnvelope(envelope: ArtifactStoreEnvelope): void {
    if (!isEnvelope(envelope)) {
      throw new ArtifactRepositoryError(
        "INVALID_STORE",
        "Artifact store write failed integrity validation.",
      );
    }
    try {
      storage.setItem(ARTIFACT_STORE_KEY, JSON.stringify(envelope));
    } catch {
      throw new ArtifactRepositoryError(
        "VALIDATION",
        "Artifact store could not persist this change.",
      );
    }
  }

  return {
    async getArtifact(scope, actor, artifactId) {
      await delay();
      validateScope(scope);
      validateActor(actor);
      if (!isNonEmptyString(artifactId)) {
        throw new ArtifactRepositoryError(
          "VALIDATION",
          "Artifact ID is invalid.",
        );
      }
      const artifact = readEnvelope().artifacts.find(
        (candidate) =>
          candidate.id === artifactId &&
          candidate.scope.organizationId === scope.organizationId &&
          candidate.scope.workspaceId === scope.workspaceId,
      );
      if (!artifact) {
        throw new ArtifactRepositoryError(
          "NOT_FOUND",
          "Artifact was not found.",
        );
      }
      return cloneMutable(artifact);
    },

    async submitTechnicalSolution(producerAgentId, draft) {
      await delay();
      if (producerAgentId !== "agent-rd-001") {
        throw new ArtifactRepositoryError(
          "FORBIDDEN",
          "Artifact producer is not authorized.",
        );
      }
      validateDraft(draft);
      const envelope = readEnvelope();
      const artifactId = `artifact-${draft.taskId}`;
      const existing = envelope.artifacts.find(
        ({ id }) => id === artifactId,
      );
      if (existing) {
        return cloneMutable(existing);
      }
      const timestamp = currentTimestamp();
      const artifact: TechnicalSolutionArtifact = {
        id: artifactId,
        scope: cloneMutable(draft.scope),
        title: draft.title,
        artifactType: "技术方案",
        status: "PENDING_REVIEW",
        version: {
          artifactId,
          versionId: `${artifactId}-v1`,
          versionNumber: 1,
          digest: `sha256:${artifactId}-v1`,
        },
        sections: cloneMutable(draft.sections),
        validationResults: [
          {
            id: `${artifactId}-validation-structure`,
            name: "Artifact 结构完整性",
            status: "PASSED",
            summary: "八个必需章节均已生成。",
          },
          {
            id: `${artifactId}-validation-citation`,
            name: "Knowledge Citation 可追溯",
            status: "PASSED",
            summary: "引用固定 KnowledgeVersion 与定位信息。",
          },
          {
            id: `${artifactId}-validation-review`,
            name: "Reviewer 人工验收",
            status: "PENDING",
            summary: "等待陈明（user-lead）验收。",
          },
        ],
        citations: cloneMutable(draft.citations),
        provenance: {
          taskId: draft.taskId,
          runId: draft.runId,
          agentVersionId: draft.agentVersionId,
          capabilityVersionIds: cloneMutable(draft.capabilityVersionIds),
          knowledgeVersionIds: cloneMutable(draft.knowledgeVersionIds),
          workflowVersionId: draft.workflowVersionId,
          toolVersionIds: cloneMutable(draft.toolVersionIds),
          generatedAt: timestamp,
          contentDigest: draft.contentDigest,
        },
        reviewerUserIds: cloneMutable(draft.reviewerUserIds),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      envelope.artifacts.push(artifact);
      writeEnvelope(envelope);
      return cloneMutable(artifact);
    },

    async acceptArtifact(scope, actor, artifactId) {
      await delay();
      validateScope(scope);
      validateActor(actor);
      const envelope = readEnvelope();
      const artifact = envelope.artifacts.find(
        (candidate) =>
          candidate.id === artifactId &&
          candidate.scope.organizationId === scope.organizationId &&
          candidate.scope.workspaceId === scope.workspaceId,
      );
      if (!artifact) {
        throw new ArtifactRepositoryError(
          "NOT_FOUND",
          "Artifact was not found.",
        );
      }
      if (!artifact.reviewerUserIds.includes(actor.userId)) {
        throw new ArtifactRepositoryError(
          "FORBIDDEN",
          "Artifact reviewer is not authorized.",
        );
      }
      if (artifact.status === "ACCEPTED") {
        return cloneMutable(artifact);
      }
      const timestamp = currentTimestamp();
      artifact.status = "ACCEPTED";
      artifact.acceptedByUserId = actor.userId;
      artifact.acceptedAt = timestamp;
      artifact.updatedAt = timestamp;
      artifact.validationResults = artifact.validationResults.map((result) =>
        result.name === "Reviewer 人工验收"
          ? {
              ...result,
              status: "PASSED",
              summary: "陈明（user-lead）已验收该版本。",
            }
          : result,
      );
      writeEnvelope(envelope);
      return cloneMutable(artifact);
    },
  };
}

function defaultRepository(): ArtifactRepository {
  return createArtifactRepository();
}

export async function getArtifact(
  scope: ArtifactScope,
  actor: ArtifactActor,
  artifactId: string,
): Promise<TechnicalSolutionArtifact> {
  return defaultRepository().getArtifact(scope, actor, artifactId);
}

export async function submitTechnicalSolution(
  producerAgentId: "agent-rd-001",
  draft: TechnicalSolutionArtifactDraft,
): Promise<TechnicalSolutionArtifact> {
  return defaultRepository().submitTechnicalSolution(
    producerAgentId,
    draft,
  );
}

export async function acceptArtifact(
  scope: ArtifactScope,
  actor: ArtifactActor,
  artifactId: string,
): Promise<TechnicalSolutionArtifact> {
  return defaultRepository().acceptArtifact(scope, actor, artifactId);
}
