"use client";

import {
  AlertCircle,
  LoaderCircle,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";

import {
  getDraft,
  getTaskPermission,
  TaskRepositoryError,
} from "../mock/task-repository";
import type { TaskDraft } from "../model";
import { TaskWizard } from "./task-wizard";

type LoaderState =
  | { status: "idle" }
  | { status: "ready"; requestKey: string; draft?: TaskDraft }
  | { status: "forbidden"; requestKey: string }
  | {
      status: "error";
      requestKey: string;
      reason: "INVALID_STORE" | "GENERAL";
    };

export function TaskWizardLoader() {
  const { hydrated, organization, user, workspace } = useSession();
  const [state, setState] = useState<LoaderState>({ status: "idle" });
  const [retryVersion, setRetryVersion] = useState(0);
  const latestRequestRef = useRef(0);
  const completeSession = Boolean(
    hydrated && user && organization && workspace,
  );
  const requestKey =
    completeSession && user && organization && workspace
      ? [
          organization.id,
          workspace.id,
          user.id,
          retryVersion,
        ].join(":")
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
      .then(async (decision) => {
        if (!active || requestId !== latestRequestRef.current) {
          return;
        }
        if (!decision.allowed) {
          setState({ status: "forbidden", requestKey });
          return;
        }

        const draft = await getDraft(scope, actor);
        if (active && requestId === latestRequestRef.current) {
          setState({ status: "ready", requestKey, draft });
        }
      })
      .catch((error: unknown) => {
        if (!active || requestId !== latestRequestRef.current) {
          return;
        }
        if (
          error instanceof TaskRepositoryError &&
          error.code === "FORBIDDEN"
        ) {
          setState({ status: "forbidden", requestKey });
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
        <span>正在加载 Task 创建权限与草稿…</span>
      </Card>
    );
  }

  if (state.status === "forbidden") {
    return (
      <Card
        className="mx-auto max-w-xl border-[color-mix(in_srgb,var(--aios-warning)_35%,var(--aios-surface))] p-6"
        role="alert"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--aios-warning-foreground)]"
            size={21}
          />
          <div>
            <h1 className="font-semibold">当前身份不能创建 Task</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
              当前身份在此 Organization 与 Workspace 中只有 Task
              只读权限。系统未读取或写入任何个人草稿。
            </p>
          </div>
        </div>
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
            <h1 className="font-semibold">Task 草稿加载失败</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
              {state.reason === "INVALID_STORE"
                ? "本地草稿未通过完整性校验，已拒绝加载不可信内容。"
                : "Task Repository 暂时不可用，未展示任何可能串租户的草稿。"}
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
    <TaskWizard
      key={requestKey}
      actor={{ userId: user.id }}
      initialDraft={state.draft}
      scope={{
        organizationId: organization.id,
        workspaceId: workspace.id,
      }}
      scopeLabels={{
        organizationName: organization.name,
        workspaceName: workspace.name,
      }}
    />
  );
}
