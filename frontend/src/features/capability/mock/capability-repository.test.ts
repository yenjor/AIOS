import { describe, expect, it } from "vitest";

import type {
  CapabilityActor,
  CapabilityScope,
  CreateCapabilityInput,
} from "../model";
import {
  CAPABILITY_STORE_KEY,
  CapabilityRepositoryError,
  createCapabilityRepository,
  type CapabilityStorage,
} from "./capability-repository";

class MemoryStorage implements CapabilityStorage {
  values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const scope: CapabilityScope = {
  organizationId: "org-guangwei",
  workspaceId: "ws-ai",
};
const manager: CapabilityActor = { userId: "user-lead" };
const developer: CapabilityActor = { userId: "user-dev" };
const auditor: CapabilityActor = { userId: "user-auditor" };
const input: CreateCapabilityInput = {
  code: "TECHNICAL_RESEARCH",
  name: "技术调研",
  purpose: "读取授权上下文并生成可验收的技术调研方案。",
  ownerId: "user-lead",
  taskType: "GENERATE_TECHNICAL_DESIGN",
  promptId: "prompt-technical-research",
  modelProfile: "reasoning-structured-output",
  workflowId: "workflow-technical-research",
  artifactType: "TECHNICAL_DESIGN",
  includeKnowledge: true,
  toolAction: "codegraph.context",
};

function repository(storage = new MemoryStorage()) {
  return createCapabilityRepository({
    storage,
    delay: async () => undefined,
    now: () => "2026-07-26T10:00:00.000Z",
  });
}

describe("Capability Mock Repository", () => {
  it("exposes only Published versions as Task selection options", async () => {
    const options = await repository().listPublishedOptions(
      scope,
      developer,
      "GENERATE_TECHNICAL_DESIGN",
    );

    expect(options).toHaveLength(1);
    expect(options[0].versionRef).toEqual({
      kind: "CAPABILITY",
      objectId: "capability-technical-solution",
      versionId: "capability-technical-solution-v1",
      versionNumber: 1,
      digest: "sha256:capability-technical-solution-v1",
    });
    expect(options[0].knowledgeRequired).toBe(true);
    expect(options[0].toolActions).toEqual(["codegraph.context"]);
  });

  it("runs Draft through evaluation, review and publish before Task use", async () => {
    const repo = repository();
    const created = await repo.createCapability(scope, manager, input);
    const draft = created.versions[0];

    expect(draft.status).toBe("DRAFT");
    await expect(
      repo.publishVersion(scope, manager, created.id, draft.id),
    ).rejects.toMatchObject({
      code: "CAPABILITY_NOT_PUBLISHABLE",
    });

    const evaluated = await repo.evaluateVersion(
      scope,
      manager,
      created.id,
      draft.id,
    );
    expect(evaluated.versions[0].status).toBe("IN_REVIEW");
    expect(evaluated.versions[0].evaluationSummaries[0]).toMatchObject({
      result: "PASSED",
      safetyPassed: true,
      artifactContractPassed: true,
      permissionNegativePassed: true,
    });

    const published = await repo.publishVersion(
      scope,
      manager,
      created.id,
      draft.id,
    );
    expect(published.publishedVersionId).toBe(draft.id);
    expect(published.versions[0].status).toBe("PUBLISHED");

    const options = await repo.listPublishedOptions(
      scope,
      developer,
      "GENERATE_TECHNICAL_DESIGN",
    );
    expect(options.map(({ capabilityId }) => capabilityId)).toContain(
      created.id,
    );
  });

  it("suspends new Task resolution without mutating the version content", async () => {
    const repo = repository();
    const before = await repo.getCapability(
      scope,
      manager,
      "capability-technical-solution",
    );
    const published = before.versions[0];

    const suspended = await repo.suspendVersion(
      scope,
      manager,
      before.id,
      published.id,
      "依赖健康检查失败",
    );

    expect(suspended.versions[0].status).toBe("SUSPENDED");
    expect(suspended.versions[0].contentDigest).toBe(
      published.contentDigest,
    );
    await expect(
      repo.resolvePublishedVersion(
        scope,
        developer,
        published.id,
        "GENERATE_TECHNICAL_DESIGN",
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("enforces Builder permissions and fails closed on a corrupted store", async () => {
    const storage = new MemoryStorage();
    const repo = repository(storage);

    await expect(
      repo.createCapability(scope, auditor, input),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    storage.setItem(CAPABILITY_STORE_KEY, '{"schemaVersion":1,"items":[]}');
    await expect(repo.getSummary(scope, manager)).rejects.toBeInstanceOf(
      CapabilityRepositoryError,
    );
    expect(storage.getItem(CAPABILITY_STORE_KEY)).toBeNull();
  });
});
