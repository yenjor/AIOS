"use client";

import { AlertCircle, LoaderCircle, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";

import { AgentDetailScreen } from "./agent-detail-screen";
import {
  AgentRepositoryError,
  createAgentVersion,
  disableAgent,
  getAgent,
  getAgentPermission,
  publishAgentVersion,
  resumeAgent,
  suspendAgent,
  testAgentVersion,
} from "./mock/agent-repository";
import type { Agent, AgentPermissionDecision } from "./model";

type State =
  | { status: "idle" }
  | {
      status: "ready";
      requestKey: string;
      item: Agent;
      permission: AgentPermissionDecision;
    }
  | { status: "unavailable"; requestKey: string }
  | { status: "error"; requestKey: string };

export type AgentAction =
  | "CREATE_VERSION"
  | "TEST"
  | "PUBLISH"
  | "SUSPEND"
  | "RESUME"
  | "DISABLE";

export type AgentActionState =
  | { status: "idle" }
  | { status: "working"; action: AgentAction; versionId?: string }
  | { status: "error"; message: string };

export function AgentDetailLoader({ agentId }: { agentId: string }) {
  const { hydrated, organization, user, workspace } = useSession();
  const [state, setState] = useState<State>({ status: "idle" });
  const [actionState, setActionState] = useState<AgentActionState>({
    status: "idle",
  });
  const latestRef = useRef(0);
  const complete = Boolean(hydrated && organization && user && workspace);
  const requestKey =
    complete && organization && user && workspace
      ? `${organization.id}:${workspace.id}:${user.id}:${agentId}`
      : undefined;

  useEffect(() => {
    if (!requestKey || !organization || !user || !workspace) return;
    const requestId = ++latestRef.current;
    let active = true;
    const scope = {
      organizationId: organization.id,
      workspaceId: workspace.id,
    };
    const actor = { userId: user.id };
    void Promise.all([
      getAgent(scope, actor, agentId),
      getAgentPermission(scope, actor),
    ])
      .then(([item, permission]) => {
        if (active && requestId === latestRef.current) {
          setState({ status: "ready", requestKey, item, permission });
        }
      })
      .catch((error: unknown) => {
        if (!active || requestId !== latestRef.current) return;
        if (
          error instanceof AgentRepositoryError &&
          (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")
        ) {
          setState({ status: "unavailable", requestKey });
        } else {
          setState({ status: "error", requestKey });
        }
      });
    return () => {
      active = false;
    };
  }, [agentId, organization, requestKey, user, workspace]);

  if (
    !requestKey ||
    !organization ||
    !user ||
    !workspace ||
    state.status === "idle" ||
    state.requestKey !== requestKey
  ) {
    return complete ? (
      <Card
        role="status"
        className="mx-auto flex max-w-xl items-center gap-3 p-6"
      >
        <LoaderCircle
          className="animate-spin text-[var(--aios-primary)] motion-reduce:animate-none"
          size={21}
          aria-hidden="true"
        />
        正在加载 AI 员工聚合、固定版本与治理证据…
      </Card>
    ) : null;
  }

  if (state.status === "unavailable") {
    return (
      <Card role="alert" className="mx-auto max-w-xl p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert
            size={21}
            className="mt-0.5 text-[var(--aios-warning-foreground)]"
            aria-hidden="true"
          />
          <div>
            <h1 className="font-semibold">AI 员工不可用</h1>
            <p className="mt-2 text-sm text-[var(--aios-muted)]">
              当前组织、工作空间或身份不能安全查看该 AI 员工。
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card role="alert" className="mx-auto max-w-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle
            size={21}
            className="mt-0.5 text-[var(--aios-error-foreground)]"
            aria-hidden="true"
          />
          <div>
            <h1 className="font-semibold">AI 员工数据加载失败</h1>
            <p className="mt-2 text-sm text-[var(--aios-muted)]">
              本地数据未通过完整性校验，未展示不可信内容。
            </p>
          </div>
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
  const readyRequestKey = requestKey;

  async function perform(
    action: AgentAction,
    versionId?: string,
    reason = "",
  ) {
    setActionState({
      status: "working",
      action,
      ...(versionId ? { versionId } : {}),
    });
    try {
      let item: Agent;
      if (action === "CREATE_VERSION") {
        item = await createAgentVersion(scope, actor, agentId);
      } else if (action === "TEST") {
        item = await testAgentVersion(
          scope,
          actor,
          agentId,
          versionId!,
        );
      } else if (action === "PUBLISH") {
        item = await publishAgentVersion(
          scope,
          actor,
          agentId,
          versionId!,
        );
      } else if (action === "SUSPEND") {
        item = await suspendAgent(scope, actor, agentId, reason);
      } else if (action === "RESUME") {
        item = await resumeAgent(scope, actor, agentId);
      } else {
        item = await disableAgent(scope, actor, agentId);
      }
      setState({
        status: "ready",
        requestKey: readyRequestKey,
        item,
        permission,
      });
      setActionState({ status: "idle" });
    } catch (error) {
      setActionState({
        status: "error",
        message:
          error instanceof AgentRepositoryError
            ? error.message
            : "AI 员工状态变更失败，已保留最后一个有效状态。",
      });
    }
  }

  return (
    <AgentDetailScreen
      item={state.item}
      permission={state.permission}
      actionState={actionState}
      onAction={perform}
      scopeLabels={{
        organizationName: organization.name,
        workspaceName: workspace.name,
      }}
    />
  );
}
