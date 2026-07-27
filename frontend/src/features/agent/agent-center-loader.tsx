"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";

import { AgentCenterScreen } from "./agent-center-screen";
import {
  AgentRepositoryError,
  getAgentPermission,
  getAgentSummary,
  listAgents,
} from "./mock/agent-repository";
import type {
  AgentPage,
  AgentPermissionDecision,
  AgentQuery,
  AgentSummary,
} from "./model";

type LoaderState =
  | { status: "idle" }
  | {
      status: "ready";
      requestKey: string;
      page: AgentPage;
      summary: AgentSummary;
      permission: AgentPermissionDecision;
    }
  | {
      status: "error";
      requestKey: string;
      invalidStore: boolean;
    };

export function AgentCenterLoader() {
  const { hydrated, organization, user, workspace } = useSession();
  const [query, setQuery] = useState<AgentQuery>({ page: 1, pageSize: 20 });
  const [retryVersion, setRetryVersion] = useState(0);
  const [state, setState] = useState<LoaderState>({ status: "idle" });
  const latestRef = useRef(0);
  const complete = Boolean(hydrated && organization && user && workspace);
  const queryKey = JSON.stringify(query);
  const requestKey =
    complete && organization && user && workspace
      ? `${organization.id}:${workspace.id}:${user.id}:${retryVersion}:${queryKey}`
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
      listAgents(scope, actor, query),
      getAgentSummary(scope, actor),
      getAgentPermission(scope, actor),
    ])
      .then(([page, summary, permission]) => {
        if (active && requestId === latestRef.current) {
          setState({
            status: "ready",
            requestKey,
            page,
            summary,
            permission,
          });
        }
      })
      .catch((error: unknown) => {
        if (active && requestId === latestRef.current) {
          setState({
            status: "error",
            requestKey,
            invalidStore:
              error instanceof AgentRepositoryError &&
              error.code === "INVALID_STORE",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [organization, query, queryKey, requestKey, user, workspace]);

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
          aria-hidden="true"
          className="animate-spin text-[var(--aios-primary)] motion-reduce:animate-none"
          size={21}
        />
        正在加载 AI 员工、版本与治理摘要…
      </Card>
    ) : null;
  }

  if (state.status === "error") {
    return (
      <Card role="alert" className="mx-auto max-w-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 text-[var(--aios-error-foreground)]"
            size={21}
          />
          <div>
            <h1 className="font-semibold">AI 员工中心数据加载失败</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
              {state.invalidStore
                ? "本地 AI 员工数据未通过完整性校验，已拒绝展示不可信内容。"
                : "AI 员工数据仓储暂时不可用，请重试。"}
            </p>
            <Button
              className="mt-4"
              variant="secondary"
              onClick={() => {
                setState({ status: "idle" });
                setRetryVersion((current) => current + 1);
              }}
            >
              重试加载
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <AgentCenterScreen
      page={state.page}
      summary={state.summary}
      permission={state.permission}
      query={query}
      onQueryChange={setQuery}
      scopeLabels={{
        organizationName: organization.name,
        workspaceName: workspace.name,
      }}
    />
  );
}
