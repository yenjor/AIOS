import { beforeEach, describe, expect, it } from "vitest";

import type { TechnicalSolutionArtifactDraft } from "../model";
import {
  ARTIFACT_STORE_KEY,
  ArtifactRepositoryError,
  createArtifactRepository,
} from "./artifact-repository";

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

const scope = {
  organizationId: "org-guangwei",
  workspaceId: "ws-ai",
};

const sectionTitles = [
  "目标理解",
  "范围与不做事项",
  "影响模块与文件",
  "技术决策",
  "风险",
  "测试建议",
  "回退考虑",
  "知识库引用",
] as const;

const draft: TechnicalSolutionArtifactDraft = {
  scope,
  taskId: "task-mock-0001",
  runId: "run-task-mock-0001-01",
  title: "Task Center 黄金路径 · 技术方案",
  sections: sectionTitles.map((title) => ({
    title,
    paragraphs: [`${title}的确定性结果。`],
  })),
  citations: [
    {
      knowledgeVersionId: "knowledge-aios-docs-v1",
      locator: "README.md#5-系统整体架构",
      digest:
        "sha256:citation:knowledge-aios-docs-v1:readme-architecture",
    },
  ],
  agentVersionId: "agent-rd-001-v1",
  capabilityVersionIds: ["capability-technical-solution-v1"],
  knowledgeVersionIds: ["knowledge-aios-docs-v1"],
  workflowVersionId: "workflow-technical-solution-v1",
  toolVersionIds: ["tool-codegraph-read-v1"],
  promptVersionId: "prompt-technical-solution-v1",
  modelPolicyProfile: "reasoning-structured-output",
  modelInvocationId: "model-invocation-0123456789abcdef",
  modelAlias: "aios-technical-design",
  resolvedModel: "test-provider-model",
  modelOutputDigest: "sha256:model-output",
  reviewerUserIds: ["user-lead"],
  contentDigest: "sha256:artifact-task-mock-0001-v1:content",
};

function expectRepositoryError(
  error: unknown,
  code: ArtifactRepositoryError["code"],
): boolean {
  expect(error).toBeInstanceOf(ArtifactRepositoryError);
  expect((error as ArtifactRepositoryError).code).toBe(code);
  return true;
}

describe("Artifact mock repository", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  function repository() {
    return createArtifactRepository({
      storage,
      delay: async () => undefined,
      now: () => "2026-07-26T09:00:00.000Z",
    });
  }

  it("persists an immutable pending technical solution with validation evidence", async () => {
    const first = await repository().submitTechnicalSolution(
      "agent-rd-001",
      draft,
    );
    expect(first).toMatchObject({
      id: "artifact-task-mock-0001",
      status: "PENDING_REVIEW",
      version: {
        versionId: "artifact-task-mock-0001-v1",
        versionNumber: 1,
      },
      provenance: {
        taskId: "task-mock-0001",
        agentVersionId: "agent-rd-001-v1",
      },
    });
    expect(first.sections.map(({ title }) => title)).toEqual(sectionTitles);
    expect(first.validationResults.map(({ status }) => status)).toEqual([
      "PASSED",
      "PASSED",
      "PENDING",
    ]);

    first.title = "调用者污染";
    await expect(
      repository().getArtifact(
        scope,
        { userId: "user-pm" },
        first.id,
      ),
    ).resolves.toMatchObject({
      title: "Task Center 黄金路径 · 技术方案",
    });

    const idempotent = await repository().submitTechnicalSolution(
      "agent-rd-001",
      { ...draft, title: "重试不覆盖已生成版本" },
    );
    expect(idempotent.title).toBe("Task Center 黄金路径 · 技术方案");
  });

  it("allows only the fixed Agent to produce and only the Reviewer to accept", async () => {
    await expect(
      repository().submitTechnicalSolution(
        "agent-other" as "agent-rd-001",
        draft,
      ),
    ).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "FORBIDDEN"),
    );

    const artifact = await repository().submitTechnicalSolution(
      "agent-rd-001",
      draft,
    );
    await expect(
      repository().acceptArtifact(
        scope,
        { userId: "user-pm" },
        artifact.id,
      ),
    ).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "FORBIDDEN"),
    );

    const accepted = await repository().acceptArtifact(
      scope,
      { userId: "user-lead" },
      artifact.id,
    );
    expect(accepted).toMatchObject({
      status: "ACCEPTED",
      acceptedByUserId: "user-lead",
      acceptedAt: "2026-07-26T09:00:00.000Z",
    });
    expect(accepted.validationResults.every(({ status }) => status === "PASSED"))
      .toBe(true);
    await expect(
      repository().acceptArtifact(
        scope,
        { userId: "user-lead" },
        artifact.id,
      ),
    ).resolves.toEqual(accepted);
  });

  it("fails closed and clears structurally invalid persisted Artifact data", async () => {
    await repository().submitTechnicalSolution("agent-rd-001", draft);
    const envelope = JSON.parse(
      storage.getItem(ARTIFACT_STORE_KEY)!,
    ) as Record<string, unknown>;
    const artifacts = envelope.artifacts as Array<Record<string, unknown>>;
    const sections = artifacts[0].sections as Array<Record<string, unknown>>;
    sections[0].title = "被篡改的章节";
    storage.setItem(ARTIFACT_STORE_KEY, JSON.stringify(envelope));

    await expect(
      repository().getArtifact(
        scope,
        { userId: "user-auditor" },
        "artifact-task-mock-0001",
      ),
    ).rejects.toSatisfy(
      (error: unknown) => expectRepositoryError(error, "INVALID_STORE"),
    );
    expect(storage.getItem(ARTIFACT_STORE_KEY)).toBeNull();
  });
});
