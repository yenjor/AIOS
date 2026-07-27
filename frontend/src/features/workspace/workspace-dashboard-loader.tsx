"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";
import { getWorkspaceDashboard } from "@/mock/repository";
import type { WorkspaceDashboard } from "@/types/domain";

import { DashboardScreen } from "./dashboard-screen";

type LoaderState =
  | { status: "idle" }
  | { status: "ready"; workspaceId: string; snapshot: WorkspaceDashboard }
  | { status: "error"; workspaceId: string };

export function WorkspaceDashboardLoader() {
  const { hydrated, organization, user, workspace } = useSession();
  const [state, setState] = useState<LoaderState>({ status: "idle" });
  const [requestVersion, setRequestVersion] = useState(0);
  const latestRequestRef = useRef(0);
  const workspaceId = workspace?.id;
  const hasCompleteSession = Boolean(
    hydrated && user && organization && workspaceId,
  );

  useEffect(() => {
    if (!hasCompleteSession || !workspaceId) {
      return;
    }

    const requestId = ++latestRequestRef.current;
    let active = true;

    void getWorkspaceDashboard(workspaceId)
      .then((snapshot) => {
        if (active && requestId === latestRequestRef.current) {
          setState({ status: "ready", workspaceId, snapshot });
        }
      })
      .catch(() => {
        if (active && requestId === latestRequestRef.current) {
          setState({ status: "error", workspaceId });
        }
      });

    return () => {
      active = false;
    };
  }, [hasCompleteSession, requestVersion, workspaceId]);

  if (!hasCompleteSession || !workspaceId) {
    return null;
  }

  if (
    state.status === "idle" ||
    state.workspaceId !== workspaceId
  ) {
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
        <span>正在加载工作空间数据…</span>
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
            <h1 className="font-semibold">工作空间数据加载失败</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
              当前只读快照暂时不可用，请重试加载。
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

  return <DashboardScreen snapshot={state.snapshot} />;
}
