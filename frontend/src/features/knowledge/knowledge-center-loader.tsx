"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";

import { KnowledgeCenterScreen } from "./knowledge-center-screen";
import {
  getKnowledgePermission,
  getKnowledgeSummary,
  KnowledgeRepositoryError,
  listKnowledge,
} from "./mock/knowledge-repository";
import type {
  KnowledgePage,
  KnowledgePermissionDecision,
  KnowledgeQuery,
  KnowledgeSummary,
} from "./model";

const INITIAL_QUERY: KnowledgeQuery = {
  page: 1,
  pageSize: 8,
};

interface ReadyPayload {
  permission: KnowledgePermissionDecision;
  summary: KnowledgeSummary;
  page: KnowledgePage;
}

type LoaderState =
  | { status: "idle" }
  | { status: "ready"; requestKey: string; payload: ReadyPayload }
  | {
      status: "error";
      requestKey: string;
      reason: "INVALID_STORE" | "GENERAL";
    };

export function KnowledgeCenterLoader() {
  const { hydrated, organization, user, workspace } = useSession();
  const [query, setQuery] = useState<KnowledgeQuery>(INITIAL_QUERY);
  const [retryVersion, setRetryVersion] = useState(0);
  const [state, setState] = useState<LoaderState>({ status: "idle" });
  const latestRequestRef = useRef(0);
  const complete = Boolean(hydrated && organization && user && workspace);
  const queryKey = useMemo(() => JSON.stringify(query), [query]);
  const requestKey =
    complete && organization && user && workspace
      ? `${organization.id}:${workspace.id}:${user.id}:${retryVersion}:${queryKey}`
      : undefined;

  useEffect(() => {
    if (!requestKey || !organization || !user || !workspace) {
      return;
    }
    const requestId = ++latestRequestRef.current;
    let active = true;
    const scope = {
      organizationId: organization.id,
      workspaceId: workspace.id,
    };
    const actor = { userId: user.id };

    void Promise.all([
      getKnowledgePermission(scope, actor),
      getKnowledgeSummary(scope, actor),
      listKnowledge(scope, actor, query),
    ])
      .then(([permission, summary, page]) => {
        if (active && requestId === latestRequestRef.current) {
          setState({
            status: "ready",
            requestKey,
            payload: { permission, summary, page },
          });
        }
      })
      .catch((error: unknown) => {
        if (!active || requestId !== latestRequestRef.current) {
          return;
        }
        setState({
          status: "error",
          requestKey,
          reason:
            error instanceof KnowledgeRepositoryError &&
            error.code === "INVALID_STORE"
              ? "INVALID_STORE"
              : "GENERAL",
        });
      });

    return () => {
      active = false;
    };
  }, [organization, query, requestKey, user, workspace]);

  if (
    !complete ||
    !requestKey ||
    !organization ||
    !user ||
    !workspace
  ) {
    return null;
  }

  if (state.status === "idle" || state.requestKey !== requestKey) {
    return (
      <Card
        role="status"
        aria-live="polite"
        className="mx-auto flex max-w-xl items-center gap-3 p-6"
      >
        <LoaderCircle
          className="animate-spin text-[var(--aios-primary)] motion-reduce:animate-none"
          size={21}
          aria-hidden="true"
        />
        正在加载 Knowledge Center…
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card role="alert" className="mx-auto max-w-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 text-[var(--aios-error-foreground)]"
            size={21}
            aria-hidden="true"
          />
          <div>
            <h1 className="font-semibold">Knowledge 数据加载失败</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
              {state.reason === "INVALID_STORE"
                ? "本地 Knowledge 数据未通过完整性校验，已拒绝展示不可信内容。"
                : "Knowledge Repository 暂时不可用，请重试。"}
            </p>
            <Button
              className="mt-4"
              variant="secondary"
              onClick={() => {
                setState({ status: "idle" });
                setRetryVersion((version) => version + 1);
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
    <KnowledgeCenterScreen
      permission={state.payload.permission}
      summary={state.payload.summary}
      page={state.payload.page}
      query={query}
      onQueryChange={setQuery}
      scopeLabels={{
        organizationName: organization.name,
        workspaceName: workspace.name,
      }}
    />
  );
}
