import { beforeEach, describe, expect, it } from "vitest";

import type {
  CreateMcpServerInput,
  ToolActor,
  ToolScope,
} from "../model";
import {
  TOOL_STORE_KEY,
  ToolRepositoryError,
  createToolRepository,
  type ToolStorage,
} from "./tool-repository";

class MemoryStorage implements ToolStorage {
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

const scope: ToolScope = {
  organizationId: "org-guangwei",
  workspaceId: "ws-ai",
};
const manager: ToolActor = { userId: "user-lead" };
const developer: ToolActor = { userId: "user-dev" };
const auditor: ToolActor = { userId: "user-auditor" };
const input: CreateMcpServerInput = {
  serverIdentity: "aios.requirement.reader",
  displayName: "需求文档 MCP Server",
  publisher: "AIOS Internal",
  serverVersion: "1.0.0",
  transport: "STDIO",
  endpointReference: "runtime://requirement-reader",
  credentialReference: "secret://workspace/requirement-reader",
  toolCode: "REQUIREMENT_READ",
  toolName: "需求文档读取",
  toolDescription: "读取当前 Workspace 授权的需求文档。",
  actionName: "requirement.read",
  actionDescription: "读取固定范围内的需求文档。",
  riskLevel: "R0",
};

function repository(storage = new MemoryStorage()) {
  return createToolRepository({
    storage,
    delay: async () => undefined,
    now: () => "2026-07-27T06:00:00.000Z",
  });
}

describe("Tool / MCP Mock Repository", () => {
  beforeEach(() => {
    window.localStorage.removeItem(TOOL_STORE_KEY);
  });

  it("only exposes enabled, published and healthy read actions", async () => {
    const options = await repository().listPublishedActionOptions(
      scope,
      developer,
    );

    expect(options).toEqual([
      expect.objectContaining({
        toolId: "tool-codegraph-read",
        toolVersionId: "tool-codegraph-read-v1",
        action: "codegraph.context",
        operationType: "READ",
        riskLevel: "R0",
        mcpServerId: "mcp-codegraph-local",
      }),
    ]);
  });

  it("gates a discovered candidate through test and explicit publish", async () => {
    const repo = repository();
    const created = await repo.createMcpServer(scope, manager, input);

    expect(created).toMatchObject({
      id: "mcp-custom-0001",
      status: "DRAFT",
      healthStatus: "UNKNOWN",
      toolId: "tool-custom-0001",
      credentialReference: "secret://workspace/requirement-reader",
    });
    await expect(
      repo.publishMcpServer(scope, manager, created.id),
    ).rejects.toMatchObject({ code: "TOOL_NOT_PUBLISHABLE" });

    const tested = await repo.testMcpServer(scope, manager, created.id);
    expect(tested).toMatchObject({
      status: "TESTING",
      healthStatus: "HEALTHY",
      lastTestSummary: {
        result: "PASSED",
        identityVerified: true,
        schemaVerified: true,
        permissionNegativePassed: true,
        secretIsolationPassed: true,
      },
    });

    const published = await repo.publishMcpServer(
      scope,
      manager,
      created.id,
    );
    expect(published.status).toBe("ENABLED");
    expect(
      await repo.resolvePublishedActionOption(
        scope,
        developer,
        "tool-custom-0001-v1",
        "requirement.read",
      ),
    ).toMatchObject({ toolId: "tool-custom-0001" });
  });

  it("removes a suspended connection from Agent-bindable actions", async () => {
    const repo = repository();
    await repo.suspendMcpServer(
      scope,
      manager,
      "mcp-codegraph-local",
      "安全复核期间停止新的 Tool Invocation",
    );

    expect(
      await repo.listPublishedActionOptions(scope, developer),
    ).toHaveLength(0);

    await repo.resumeMcpServer(scope, manager, "mcp-codegraph-local");
    expect(
      await repo.listPublishedActionOptions(scope, developer),
    ).toHaveLength(1);
  });

  it("keeps Auditor read-only and rejects corrupted local state", async () => {
    const storage = new MemoryStorage();
    const repo = repository(storage);

    await expect(
      repo.createMcpServer(scope, auditor, input),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    storage.setItem(TOOL_STORE_KEY, '{"schemaVersion":1,"tools":[]}');
    await expect(repo.getToolSummary(scope, manager)).rejects.toBeInstanceOf(
      ToolRepositoryError,
    );
    expect(storage.getItem(TOOL_STORE_KEY)).toBeNull();
  });
});
