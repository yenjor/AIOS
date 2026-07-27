"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";

import {
  getTaskPermission,
  listTasks,
  TaskRepositoryError,
} from "./mock/task-repository";
import type {
  TaskPage,
  TaskPermissionDecision,
  TaskQuery,
} from "./model";
import {
  TaskCenterScreen,
  type TaskCenterSummaries,
} from "./task-center-screen";

const INITIAL_QUERY: TaskQuery = {
  ownership: "all",
  page: 1,
  pageSize: 8,
};

interface ReadyPayload {
  permission: TaskPermissionDecision;
  page: TaskPage;
  summaries: TaskCenterSummaries;
}

type LoaderState =
  | { status: "idle" }
  | { status: "ready"; requestKey: string; payload: ReadyPayload }
  | {
      status: "error";
      requestKey: string;
      reason: "INVALID_STORE" | "GENERAL";
    };

export function TaskCenterLoader() {
  const { hydrated, organization, user, workspace } = useSession();
  const [query, setQuery] = useState<TaskQuery>(INITIAL_QUERY);
  const [retryVersion, setRetryVersion] = useState(0);
  const [state, setState] = useState<LoaderState>({ status: "idle" });
  const latestRequestRef = useRef(0);
  const completeSession = Boolean(
    hydrated && user && organization && workspace,
  );
  const queryKey = useMemo(
    () =>
      JSON.stringify({
        keyword: query.keyword ?? "",
        status: query.status ?? "",
        template: query.template ?? "",
        risk: query.risk ?? "",
        ownership: query.ownership ?? "all",
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 8,
      }),
    [query],
  );
  const requestKey =
    completeSession && user && organization && workspace
      ? `${organization.id}:${workspace.id}:${user.id}:${retryVersion}:${queryKey}`
      : undefined;

  useEffect(() => {
    if (
      !completeSession ||
      !requestKey ||
      !user ||
      !organization ||
      !workspace
    ) {
      return;
    }

    const requestId = ++latestRequestRef.current;
    let active = true;
    const scope = {
      organizationId: organization.id,
      workspaceId: workspace.id,
    };
    const actor = { userId: user.id };

    void getTaskPermission(scope, actor)
      .then(async (permission) => {
        if (!active || requestId !== latestRequestRef.current) {
          return;
        }

        const [page, mine, pendingApproval, executing, pendingReview] =
          await Promise.all([
            listTasks(scope, actor, query),
            listTasks(scope, actor, {
              ownership: "mine",
              page: 1,
              pageSize: 1,
            }),
            listTasks(scope, actor, {
              ownership: "pendingApproval",
              page: 1,
              pageSize: 1,
            }),
            listTasks(scope, actor, {
              status: "EXECUTING",
              page: 1,
              pageSize: 1,
            }),
            listTasks(scope, actor, {
              ownership: "pendingReview",
              page: 1,
              pageSize: 1,
            }),
          ]);

        if (active && requestId === latestRequestRef.current) {
          setState({
            status: "ready",
            requestKey,
            payload: {
              permission,
              page,
              summaries: {
                mine: mine.total,
                pendingApproval: pendingApproval.total,
                executing: executing.total,
                pendingReview: pendingReview.total,
              },
            },
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
            error instanceof TaskRepositoryError &&
            error.code === "INVALID_STORE"
              ? "INVALID_STORE"
              : "GENERAL",
        });
      });

    return () => {
      active = false;
    };
  }, [
    completeSession,
    organization,
    query,
    requestKey,
    user,
    workspace,
  ]);

  if (
    !completeSession ||
    !requestKey ||
    !user ||
    !organization ||
    !workspace
  ) {
    return null;
  }

  if (state.status === "idle" || state.requestKey !== requestKey) {
    return (
      <Card
        className="mx-auto flex max-w-xl items-center gap-3 p-6"
        role="status"
        aria-live="polite"
      >
        <LoaderCircle
          aria-hidden="true"
          className="animate-spin text-[var(--aios-primary)] motion-reduce:animate-none"
          size={21}
        />
        <span>正在加载任务中心…</span>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card
        className="mx-auto max-w-xl border-[color-mix(in_srgb,var(--aios-error)_35%,var(--aios-surface))] p-6"
        role="alert"
      >
        <div className="flex items-start gap-3">
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--aios-error-foreground)]"
            size={21}
          />
          <div>
            <h1 className="font-semibold">任务列表加载失败</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
              {state.reason === "INVALID_STORE"
                ? "本地任务数据未通过完整性校验，已拒绝展示不可信内容。"
                : "任务仓储暂时不可用，请重试加载。"}
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
    <TaskCenterScreen
      canCreate={state.payload.permission.allowed}
      onQueryChange={setQuery}
      page={state.payload.page}
      query={query}
      scopeLabels={{
        organizationName: organization.name,
        workspaceName: workspace.name,
      }}
      summaries={state.payload.summaries}
    />
  );
}
