"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";

import {
  getMcpServer,
  getTool,
  getToolPermission,
  publishMcpServer,
  resumeMcpServer,
  suspendMcpServer,
  testMcpServer,
  ToolRepositoryError,
} from "./mock/tool-repository";
import { McpDetailScreen } from "./mcp-detail-screen";
import type {
  McpServerRegistration,
  Tool,
  ToolPermissionDecision,
} from "./model";

export type McpAction = "TEST" | "PUBLISH" | "SUSPEND" | "RESUME";
export type McpActionState =
  | { status: "idle" }
  | { status: "working"; action: McpAction }
  | { status: "error"; message: string };

type State =
  | { status: "loading" }
  | {
      status: "ready";
      server: McpServerRegistration;
      tool: Tool;
      permission: ToolPermissionDecision;
    }
  | { status: "error" };

export function McpDetailLoader({ serverId }: { serverId: string }) {
  const { hydrated, organization, user, workspace } = useSession();
  const [state, setState] = useState<State>({ status: "loading" });
  const [actionState, setActionState] = useState<McpActionState>({
    status: "idle",
  });
  const complete = Boolean(hydrated && organization && user && workspace);

  useEffect(() => {
    if (!organization || !user || !workspace) return;
    let active = true;
    const scope = {
      organizationId: organization.id,
      workspaceId: workspace.id,
    };
    const actor = { userId: user.id };
    void Promise.all([
      getMcpServer(scope, actor, serverId),
      getToolPermission(scope, actor),
    ])
      .then(async ([server, permission]) => ({
        server,
        permission,
        tool: await getTool(scope, actor, server.toolId),
      }))
      .then((ready) => {
        if (active) setState({ status: "ready", ...ready });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [organization, serverId, user, workspace]);

  if (
    !complete ||
    !organization ||
    !user ||
    !workspace ||
    state.status === "loading"
  ) {
    return complete ? (
      <Card role="status" className="mx-auto flex max-w-xl items-center gap-3 p-6">
        <LoaderCircle
          className="animate-spin text-[var(--aios-primary)] motion-reduce:animate-none"
          size={21}
          aria-hidden="true"
        />
        正在加载 MCP 服务、草稿工具版本与测试证据…
      </Card>
    ) : null;
  }

  if (state.status === "error") {
    return (
      <Card role="alert" className="mx-auto flex max-w-xl items-start gap-3 p-6">
        <AlertCircle
          className="mt-0.5 text-[var(--aios-error-foreground)]"
          size={21}
          aria-hidden="true"
        />
        <div>
          <h1 className="font-semibold">MCP 服务不可用</h1>
          <p className="mt-2 text-sm text-[var(--aios-muted)]">
            当前工作空间或身份不能安全解析该连接。
          </p>
        </div>
      </Card>
    );
  }

  const scope = {
    organizationId: organization.id,
    workspaceId: workspace.id,
  };
  const actor = { userId: user.id };
  const permission = state.permission;

  async function perform(action: McpAction, reason = "") {
    setActionState({ status: "working", action });
    try {
      let server: McpServerRegistration;
      if (action === "TEST") {
        server = await testMcpServer(scope, actor, serverId);
      } else if (action === "PUBLISH") {
        server = await publishMcpServer(scope, actor, serverId);
      } else if (action === "SUSPEND") {
        server = await suspendMcpServer(scope, actor, serverId, reason);
      } else {
        server = await resumeMcpServer(scope, actor, serverId);
      }
      const tool = await getTool(scope, actor, server.toolId);
      setState({ status: "ready", server, tool, permission });
      setActionState({ status: "idle" });
    } catch (caught) {
      setActionState({
        status: "error",
        message:
          caught instanceof ToolRepositoryError
            ? caught.message
            : "连接状态变更失败，已保留最后一个有效状态。",
      });
    }
  }

  return (
    <McpDetailScreen
      server={state.server}
      tool={state.tool}
      permission={state.permission}
      actionState={actionState}
      onAction={perform}
    />
  );
}
