import { beforeEach, describe, expect, it } from "vitest";

import type {
  AgentActor,
  AgentScope,
  CreateAgentInput,
} from "../model";
import {
  AGENT_STORE_KEY,
  AgentRepositoryError,
  createAgentRepository,
  type AgentStorage,
} from "./agent-repository";
import {
  resumeMcpServer,
  suspendMcpServer,
  TOOL_STORE_KEY,
} from "@/features/tool/mock/tool-repository";

class MemoryStorage implements AgentStorage {
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

const scope: AgentScope = {
  organizationId: "org-guangwei",
  workspaceId: "ws-ai",
};
const manager: AgentActor = { userId: "user-lead" };
const developer: AgentActor = { userId: "user-dev" };
const auditor: AgentActor = { userId: "user-auditor" };
const input: CreateAgentInput = {
  code: "AI_SOLUTION_ARCHITECT",
  name: "AI 解决方案架构师",
  roleDescription:
    "读取授权 Task、知识和代码上下文，生成由 Human Owner 验收的技术方案。",
  humanOwnerId: "user-lead",
  jobTitle: "AI 解决方案架构师",
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

function repository(storage = new MemoryStorage()) {
  return createAgentRepository({
    storage,
    delay: async () => undefined,
    now: () => "2026-07-26T15:00:00.000Z",
  });
}

describe("Agent Mock Repository", () => {
  beforeEach(() => {
    window.localStorage.removeItem(AGENT_STORE_KEY);
    window.localStorage.removeItem(TOOL_STORE_KEY);
  });

  it("only exposes Enabled Agent with a Published version and valid runtime bindings", async () => {
    const options = await repository().listEnabledOptions(
      scope,
      developer,
      "GENERATE_TECHNICAL_DESIGN",
    );

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      agentId: "agent-rd-001",
      agentName: "AI研发员工",
      autonomyLevel: "L1辅助",
      humanOwner: { userId: "user-lead", displayName: "陈明" },
      agentVersionRef: {
        kind: "AGENT",
        objectId: "agent-rd-001",
        versionId: "agent-rd-001-v1",
        versionNumber: 1,
        digest: "sha256:agent-rd-001-v1",
      },
      knowledgeScopeCount: 1,
      toolActions: ["codegraph.context"],
    });
  });

  it("runs Draft through deterministic test and publish before Task selection", async () => {
    const repo = repository();
    const created = await repo.createAgent(scope, manager, input);
    const draft = created.versions[0];

    expect(created.status).toBe("DRAFT");
    expect(draft.status).toBe("DRAFT");
    await expect(
      repo.publishVersion(scope, manager, created.id, draft.id),
    ).rejects.toMatchObject({ code: "AGENT_NOT_PUBLISHABLE" });

    const tested = await repo.testVersion(
      scope,
      manager,
      created.id,
      draft.id,
    );
    expect(tested.status).toBe("TESTING");
    expect(tested.versions[0].testSummaries[0]).toMatchObject({
      result: "PASSED",
      capabilityAssignmentsValid: true,
      permissionNegativePassed: true,
      artifactDraftPassed: true,
      promptInjectionPassed: true,
    });

    const published = await repo.publishVersion(
      scope,
      manager,
      created.id,
      draft.id,
    );
    expect(published.status).toBe("ENABLED");
    expect(published.publishedVersionId).toBe(draft.id);
    expect(published.versions[0].status).toBe("PUBLISHED");

    const options = await repo.listEnabledOptions(
      scope,
      developer,
      "GENERATE_TECHNICAL_DESIGN",
    );
    expect(options.map(({ agentId }) => agentId)).toContain(created.id);
  });

  it("suspends new Task assignment without mutating the Published AgentVersion", async () => {
    const repo = repository();
    const before = await repo.getAgent(scope, manager, "agent-rd-001");
    const digest = before.versions[0].contentDigest;

    const suspended = await repo.suspendAgent(
      scope,
      manager,
      before.id,
      "Tool Health 事件待复核",
    );
    expect(suspended.status).toBe("SUSPENDED");
    expect(suspended.versions[0].contentDigest).toBe(digest);
    await expect(
      repo.resolveAgentVersion(
        scope,
        developer,
        "agent-rd-001-v1",
        "GENERATE_TECHNICAL_DESIGN",
        "capability-technical-solution-v1",
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const resumed = await repo.resumeAgent(scope, manager, before.id);
    expect(resumed.status).toBe("ENABLED");
  });

  it("fails closed when an Agent Tool Grant points to a suspended MCP Server", async () => {
    const repo = repository();
    await suspendMcpServer(
      scope,
      manager,
      "mcp-codegraph-local",
      "连接安全复核期间停止新的 Agent Execution",
    );

    expect(
      await repo.listEnabledOptions(
        scope,
        developer,
        "GENERATE_TECHNICAL_DESIGN",
      ),
    ).toHaveLength(0);

    await resumeMcpServer(scope, manager, "mcp-codegraph-local");
    expect(
      await repo.listEnabledOptions(
        scope,
        developer,
        "GENERATE_TECHNICAL_DESIGN",
      ),
    ).toHaveLength(1);
  });

  it("enforces Agent Builder permissions and fails closed on corrupted storage", async () => {
    const storage = new MemoryStorage();
    const repo = repository(storage);

    await expect(
      repo.createAgent(scope, auditor, input),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    storage.setItem(AGENT_STORE_KEY, '{"schemaVersion":1,"items":[]}');
    await expect(repo.getSummary(scope, manager)).rejects.toBeInstanceOf(
      AgentRepositoryError,
    );
    expect(storage.getItem(AGENT_STORE_KEY)).toBeNull();
  });
});
