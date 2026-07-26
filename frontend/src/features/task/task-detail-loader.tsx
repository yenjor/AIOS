"use client";

import { AlertCircle, LoaderCircle, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";

import {
  getTask,
  TaskRepositoryError,
} from "./mock/task-repository";
import type { TaskDetail } from "./model";
import {
  approvePlanAndStartExecution,
  acceptTaskArtifact,
  advanceFirstAiEmployee,
} from "./task-execution-service";
import {
  TaskDetailScreen,
  type TaskDetailActionState,
  type TaskDetailControlledAction,
} from "./task-detail-screen";

type LoaderState =
  | { status: "idle" }
  | { status: "ready"; requestKey: string; task: TaskDetail }
  | { status: "unavailable"; requestKey: string }
  | {
      status: "error";
      requestKey: string;
      reason: "INVALID_STORE" | "GENERAL";
    };

export interface TaskDetailLoaderProps {
  taskId: string;
}

export function TaskDetailLoader({ taskId }: TaskDetailLoaderProps) {
  const { hydrated, organization, user, workspace } = useSession();
  const [state, setState] = useState<LoaderState>({ status: "idle" });
  const [actionState, setActionState] = useState<TaskDetailActionState>({
    status: "idle",
  });
  const [requestVersion, setRequestVersion] = useState(0);
  const latestRequestRef = useRef(0);
  const hasCompleteSession = Boolean(
    hydrated && user && organization && workspace,
  );
  const requestKey =
    hasCompleteSession && user && organization && workspace
      ? [
          organization.id,
          workspace.id,
          user.id,
          taskId,
          requestVersion,
        ].join(":")
      : undefined;

  useEffect(() => {
    if (
      !hasCompleteSession ||
      !requestKey ||
      !user ||
      !organization ||
      !workspace
    ) {
      return;
    }

    const requestId = ++latestRequestRef.current;
    let active = true;

    void getTask(
      {
        organizationId: organization.id,
        workspaceId: workspace.id,
      },
      { userId: user.id },
      taskId,
    )
      .then((task) => {
        if (active && requestId === latestRequestRef.current) {
          setState({ status: "ready", requestKey, task });
        }
      })
      .catch((error: unknown) => {
        if (!active || requestId !== latestRequestRef.current) {
          return;
        }

        if (
          error instanceof TaskRepositoryError &&
          (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")
        ) {
          setState({ status: "unavailable", requestKey });
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
    hasCompleteSession,
    organization,
    requestKey,
    taskId,
    user,
    workspace,
  ]);

  if (
    !hasCompleteSession ||
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
        role="status"
        aria-live="polite"
        className="mx-auto flex max-w-xl items-center gap-3 p-6"
      >
        <LoaderCircle
          className="animate-spin text-[var(--aios-primary)] motion-reduce:animate-none"
          size={21}
          aria-hidden="true"
        />
        <span>正在加载 Task 只读详情…</span>
      </Card>
    );
  }

  if (state.status === "unavailable") {
    return (
      <Card
        role="alert"
        className="mx-auto max-w-xl border-[color-mix(in_srgb,var(--aios-warning)_35%,var(--aios-surface))] p-6"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert
            className="mt-0.5 shrink-0 text-[var(--aios-warning-foreground)]"
            size={21}
            aria-hidden="true"
          />
          <div>
            <h1 className="font-semibold">Task 不可用</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
              无法在当前工作范围中安全显示该 Task。请确认当前 Organization、
              Workspace 与身份后重试。
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card
        role="alert"
        className="mx-auto max-w-xl border-[color-mix(in_srgb,var(--aios-error)_35%,var(--aios-surface))] p-6"
      >
        <div className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 shrink-0 text-[var(--aios-error-foreground)]"
            size={21}
            aria-hidden="true"
          />
          <div>
            <h1 className="font-semibold">Task 数据加载失败</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
              {state.reason === "INVALID_STORE"
                ? "本地只读数据无法通过完整性校验，已拒绝展示不可信内容。"
                : "Task Repository 暂时不可用，未展示任何可能过期的 Task 内容。"}
            </p>
            <Button
              className="mt-4"
              variant="secondary"
              onClick={() => {
                setState({ status: "idle" });
                setRequestVersion((version) => version + 1);
              }}
            >
              重试加载
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  async function handleControlledAction(
    action: TaskDetailControlledAction,
  ): Promise<void> {
    if (
      state.status !== "ready" ||
      !requestKey ||
      !user ||
      !organization ||
      !workspace
    ) {
      return;
    }

    const scope = {
      organizationId: organization.id,
      workspaceId: workspace.id,
    };
    const actor = { userId: user.id };
    setActionState({ status: "working", action });

    try {
      const task =
        action === "批准计划"
          ? await approvePlanAndStartExecution(scope, actor, taskId)
          : action === "开始执行"
            ? await advanceFirstAiEmployee(scope, actor, taskId)
            : await acceptTaskArtifact(scope, actor, taskId);
      setState({ status: "ready", requestKey, task });
      setActionState({ status: "idle" });
    } catch {
      setActionState({
        status: "error",
        action,
        message:
          "受控动作未完成。系统已保留最后一个有效状态，请确认当前身份和 Task 状态后重试。",
      });
    }
  }

  return (
    <TaskDetailScreen
      task={state.task}
      scopeLabels={{
        organizationName: organization.name,
        workspaceName: workspace.name,
      }}
      viewer={{ userId: user.id, name: user.name, role: user.role }}
      actionState={actionState}
      onControlledAction={handleControlledAction}
    />
  );
}
