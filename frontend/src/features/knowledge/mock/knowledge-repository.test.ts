import { beforeEach, describe, expect, it } from "vitest";

import type {
  KnowledgeActor,
  KnowledgeScope,
  RegisterKnowledgeInput,
} from "../model";
import {
  createKnowledgeRepository,
  KNOWLEDGE_STORE_KEY,
  KnowledgeRepositoryError,
} from "./knowledge-repository";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const scope: KnowledgeScope = {
  organizationId: "org-guangwei",
  workspaceId: "ws-ai",
};
const lead: KnowledgeActor = { userId: "user-lead" };
const admin: KnowledgeActor = { userId: "user-admin" };
const productManager: KnowledgeActor = { userId: "user-pm" };
const auditor: KnowledgeActor = { userId: "user-auditor" };

const registerInput: RegisterKnowledgeInput = {
  code: "task-center-guide",
  title: "Task Center 使用指南",
  description: "Task Center 创建、审批、执行和验收说明。",
  sourceType: "DOCUMENT",
  sourceLocation: "upload://task-center-guide.md",
  sourceAuthority: "研发管理组",
  ownerId: "user-lead",
  classification: "INTERNAL",
  purpose: "software_engineering_tasks",
  fileName: "task-center-guide.md",
  mediaType: "text/markdown",
  content:
    "# Task Center\n\nTask 必须先审批计划，再由 AI 研发员工执行并生成 Artifact。",
  contentDigest:
    "sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
};

function expectRepositoryError(
  error: unknown,
  code: KnowledgeRepositoryError["code"],
): boolean {
  expect(error).toBeInstanceOf(KnowledgeRepositoryError);
  expect((error as KnowledgeRepositoryError).code).toBe(code);
  return true;
}

describe("Knowledge mock repository", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  function repository() {
    return createKnowledgeRepository({
      storage,
      delay: async () => undefined,
      now: () => "2026-07-26T12:00:00.000Z",
    });
  }

  it("exposes authorized seed read models and hides confidential existence", async () => {
    const repo = repository();
    const regularPage = await repo.listKnowledge(scope, productManager, {
      pageSize: 20,
    });
    const managerPage = await repo.listKnowledge(scope, lead, {
      pageSize: 20,
    });

    expect(regularPage.total).toBe(3);
    expect(managerPage.total).toBe(4);
    expect(
      regularPage.items.some(({ id }) => id === "knowledge-ai-security-baseline"),
    ).toBe(false);
    expect(
      managerPage.items.some(({ id }) => id === "knowledge-ai-security-baseline"),
    ).toBe(true);
    await expect(
      repo.getKnowledge(
        scope,
        auditor,
        "knowledge-ai-security-baseline",
      ),
    ).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "NOT_FOUND"),
    );

    await expect(repo.getPermission(scope, lead)).resolves.toMatchObject({
      canRead: true,
      canManage: true,
      canSubmitCorrection: true,
    });
    await expect(repo.getPermission(scope, auditor)).resolves.toMatchObject({
      canRead: true,
      canManage: false,
      canSubmitCorrection: false,
    });
  });

  it("registers a Draft + Ready KnowledgeVersion and restores it after recreation", async () => {
    const repo = repository();
    await expect(
      repo.registerKnowledge(scope, productManager, registerInput),
    ).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "FORBIDDEN"),
    );

    const created = await repo.registerKnowledge(
      scope,
      lead,
      registerInput,
    );
    expect(created).toMatchObject({
      id: "knowledge-mock-0001",
      status: "ACTIVE",
      aggregateVersion: 1,
    });
    expect(created.effectiveVersionId).toBeUndefined();
    expect(created.versions[0]).toMatchObject({
      id: "knowledge-mock-0001-v1",
      effectiveStatus: "DRAFT",
      indexStatus: "READY",
      parserVersion: "mock-parser-v1",
      chunkerVersion: "mock-chunker-v1",
      embeddingModelVersion: "mock-embedding-v1",
    });
    expect(created.versions[0].pipelineStages).toHaveLength(6);
    expect(
      created.versions[0].pipelineStages.every(
        ({ status }) => status === "SUCCEEDED",
      ),
    ).toBe(true);

    await expect(
      repository().getKnowledge(scope, productManager, created.id),
    ).resolves.toEqual(created);
  });

  it("publishes explicitly, retrieves with Citation, and preserves version evidence", async () => {
    const repo = repository();
    const created = await repo.registerKnowledge(scope, admin, registerInput);
    const published = await repo.publishVersion(
      scope,
      admin,
      created.id,
      created.versions[0].id,
    );
    expect(published).toMatchObject({
      effectiveVersionId: "knowledge-mock-0001-v1",
      aggregateVersion: 2,
    });
    expect(published.versions[0].effectiveStatus).toBe("EFFECTIVE");

    const retrieval = await repo.retrieve(
      scope,
      productManager,
      "Task 审批 Artifact",
    );
    expect(retrieval).toMatchObject({
      outcome: "RESULTS",
      retrievalMode: "DETERMINISTIC_MOCK_HYBRID",
      purpose: "software_engineering_tasks",
    });
    expect(
      retrieval.results.find(
        ({ knowledgeId }) => knowledgeId === created.id,
      ),
    ).toMatchObject({
      versionId: "knowledge-mock-0001-v1",
      citation: {
        knowledgeVersionId: "knowledge-mock-0001-v1",
        contentLocation: "content:paragraph-best-match",
      },
    });

    const versioned = await repo.createVersion(
      scope,
      lead,
      created.id,
      {
        fileName: "task-center-guide-v2.md",
        mediaType: "text/markdown",
        content:
          "# Task Center v2\n\nTask 计划审批、Checkpoint、Artifact 验收与 Citation。",
        contentDigest:
          "sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      },
    );
    expect(versioned.versions[1]).toMatchObject({
      id: "knowledge-mock-0001-v2",
      supersedesVersionId: "knowledge-mock-0001-v1",
      effectiveStatus: "DRAFT",
    });

    const v2Published = await repo.publishVersion(
      scope,
      lead,
      created.id,
      "knowledge-mock-0001-v2",
    );
    expect(v2Published.effectiveVersionId).toBe(
      "knowledge-mock-0001-v2",
    );
    expect(v2Published.versions[0]).toMatchObject({
      effectiveStatus: "INVALIDATED",
      publishedAt: "2026-07-26T12:00:00.000Z",
      publishedBy: "user-admin",
      invalidationReason:
        "由 knowledge-mock-0001-v2 替代，历史 Citation 保留。",
    });
    expect(v2Published.versions[1].effectiveStatus).toBe("EFFECTIVE");
  });

  it("supports invalidation, explicit restore, and correction permission", async () => {
    const repo = repository();
    const invalidated = await repo.invalidateVersion(
      scope,
      lead,
      "knowledge-aios-docs",
      "knowledge-aios-docs-v1",
      "来源正在复核，暂时停止新 Task 使用。",
    );
    expect(invalidated.effectiveVersionId).toBeUndefined();
    expect(invalidated.versions[0]).toMatchObject({
      effectiveStatus: "INVALIDATED",
      publishedAt: "2026-07-25T09:00:00.000Z",
      publishedBy: "user-lead",
      invalidationReason: "来源正在复核，暂时停止新 Task 使用。",
    });

    const restored = await repo.restoreVersion(
      scope,
      lead,
      "knowledge-aios-docs",
      "knowledge-aios-docs-v1",
      "来源复核通过，允许恢复新 Task 使用。",
    );
    expect(restored.effectiveVersionId).toBe(
      "knowledge-aios-docs-v1",
    );
    expect(restored.versions[0].effectiveStatus).toBe("EFFECTIVE");

    await expect(
      repo.submitCorrection(
        scope,
        auditor,
        "knowledge-aios-docs",
        {
          targetVersionId: "knowledge-aios-docs-v1",
          reason: "需要修正架构边界描述。",
          evidenceReference: "Task task-mock-0001",
          evidenceDigest: "sha256:evidence:task-mock-0001:architecture",
        },
      ),
    ).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "FORBIDDEN"),
    );

    const corrected = await repo.submitCorrection(
      scope,
      productManager,
      "knowledge-aios-docs",
      {
        targetVersionId: "knowledge-aios-docs-v1",
        reason: "需要修正架构边界描述。",
        evidenceReference: "Task task-mock-0001",
        evidenceDigest: "sha256:evidence:task-mock-0001:architecture",
      },
    );
    expect(corrected.correctionRequests[0]).toMatchObject({
      status: "OPEN",
      submittedBy: "user-pm",
    });
  });

  it("fails closed when persisted scope or content evidence is tampered", async () => {
    const repo = repository();
    await repo.registerKnowledge(scope, lead, registerInput);
    const envelope = JSON.parse(
      storage.getItem(KNOWLEDGE_STORE_KEY)!,
    ) as Record<string, unknown>;
    const items = envelope.items as Array<Record<string, unknown>>;
    const itemScope = items[0].scope as Record<string, unknown>;
    itemScope.workspaceId = "ws-other";
    storage.setItem(KNOWLEDGE_STORE_KEY, JSON.stringify(envelope));

    await expect(
      repository().listKnowledge(scope, lead, {}),
    ).rejects.toSatisfy(
      (error: unknown) =>
        expectRepositoryError(error, "INVALID_STORE"),
    );
    expect(storage.getItem(KNOWLEDGE_STORE_KEY)).toBeNull();
  });

  it("returns independent clones and validates query boundaries", async () => {
    const repo = repository();
    const item = await repo.getKnowledge(
      scope,
      lead,
      "knowledge-aios-docs",
    );
    item.title = "调用者污染";
    await expect(
      repo.getKnowledge(scope, lead, "knowledge-aios-docs"),
    ).resolves.toMatchObject({ title: "AIOS 项目文档" });

    await expect(
      repo.listKnowledge(scope, lead, { pageSize: 51 }),
    ).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "VALIDATION"),
    );
  });
});
